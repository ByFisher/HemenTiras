<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Coupon;
use App\Models\Shop;
use App\Services\CouponService;
use App\Services\FinancialLedger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class CouponController extends Controller
{
    public function validateCode(Request $request, CouponService $coupons): JsonResponse
    {
        $data = $request->validate([
            'shop_id' => ['required', 'integer', 'exists:shops,id'],
            'code' => ['required', 'string', 'max:64'],
            'basket_amount' => ['required', 'integer', 'min:1'],
        ]);
        $shop = Shop::query()->whereKey($data['shop_id'])
            ->where('status', 'active')->where('is_approved', true)->firstOrFail();
        $quote = $coupons->quote($data['code'], $shop, $data['basket_amount']);

        return response()->json([
            'code' => $quote['coupon']->code,
            'discountAmount' => $quote['discount_amount'],
            'totalPrice' => $quote['total_price'],
        ]);
    }

    public function shopIndex(Request $request): JsonResponse
    {
        $this->expireDueCoupons();
        $shop = $this->ownerShop($request);
        $coupons = $shop->coupons()->withCount('usages')->latest()
            ->paginate(min(max($request->integer('per_page', 50), 1), 100));

        return response()->json([
            'data' => $coupons->getCollection()->map(fn (Coupon $coupon) => $this->present($coupon)),
            'meta' => [
                'currentPage' => $coupons->currentPage(),
                'lastPage' => $coupons->lastPage(),
                'perPage' => $coupons->perPage(),
                'total' => $coupons->total(),
            ],
        ]);
    }

    public function shopStore(Request $request, FinancialLedger $ledger): JsonResponse
    {
        $shop = $this->ownerShop($request);
        $data = $this->validateCreate($request);
        unset($data['shop_id']);
        $reservedBudget = $this->reservedBudget($data);

        $coupon = DB::transaction(function () use ($request, $shop, $data, $reservedBudget, $ledger): Coupon {
            $lockedShop = Shop::query()->whereKey($shop->id)->lockForUpdate()->firstOrFail();
            abort_if(
                $reservedBudget > $ledger->availableBalance($lockedShop),
                422,
                'Kuponun azami kullanım maliyeti dükkanın ayrılabilir bakiyesini aşıyor.',
            );

            return $lockedShop->coupons()->create([
                ...$data,
                'code' => $this->uniqueCode($data['code'] ?? null),
                'created_by_user_id' => $request->user()->id,
                'created_by_role' => 'shop_owner',
                'reserved_budget' => $reservedBudget,
                'status' => 'pending',
            ]);
        });

        return response()->json($this->present($coupon), 201);
    }

    public function adminIndex(Request $request): JsonResponse
    {
        $status = $request->validate(['status' => ['nullable', Rule::in(['pending', 'active', 'rejected', 'expired'])]])['status'] ?? null;
        $this->expireDueCoupons();
        $coupons = Coupon::query()
            ->with(['shop:id,name', 'creator:id,name'])
            ->withCount('usages')
            ->when($status, fn ($query) => $query->where('status', $status))
            ->latest()
            ->paginate(min(max($request->integer('per_page', 50), 1), 100));

        return response()->json([
            'data' => $coupons->getCollection()->map(fn (Coupon $coupon) => $this->present($coupon)),
            'meta' => [
                'currentPage' => $coupons->currentPage(),
                'lastPage' => $coupons->lastPage(),
                'perPage' => $coupons->perPage(),
                'total' => $coupons->total(),
            ],
        ]);
    }

    public function adminStore(Request $request): JsonResponse
    {
        $data = $this->validateCreate($request);
        $shop = isset($data['shop_id']) ? Shop::query()->findOrFail($data['shop_id']) : null;
        $coupon = Coupon::query()->create([
            ...$data,
            'code' => $this->uniqueCode($data['code'] ?? null),
            'shop_id' => $shop?->id,
            'created_by_user_id' => $request->user()->id,
            'created_by_role' => 'super_admin',
            'reserved_budget' => 0,
            'status' => 'active',
        ]);

        return response()->json($this->present($coupon), 201);
    }

    public function decide(Request $request, Coupon $coupon, string $decision): JsonResponse
    {
        abort_unless(in_array($decision, ['approve', 'reject'], true), 404);
        $this->expireDueCoupons();
        $data = $request->validate([
            'rejection_reason' => $decision === 'reject' ? ['required', 'string', 'max:500'] : ['nullable', 'string', 'max:500'],
        ]);
        $coupon = DB::transaction(function () use ($request, $coupon, $decision, $data): Coupon {
            $locked = Coupon::query()->whereKey($coupon->id)->lockForUpdate()->firstOrFail();
            abort_unless($locked->status === 'pending', 409, 'Kupon daha önce değerlendirilmiş.');
            abort_if($decision === 'approve' && $locked->expires_at->isPast(), 409, 'Süresi dolmuş kupon onaylanamaz.');
            $approve = $decision === 'approve';
            $locked->update([
                'status' => $approve ? 'active' : 'rejected',
                'reviewed_by' => $request->user()->id,
                'reviewed_at' => now(),
            ]);
            DB::table('audit_logs')->insert([
                'actor_user_id' => $request->user()->id,
                'action' => $approve ? 'coupon.approved' : 'coupon.rejected',
                'subject_type' => Coupon::class,
                'subject_id' => (string) $locked->id,
                'metadata' => json_encode([
                    'code' => $locked->code,
                    'reason' => $approve ? null : ($data['rejection_reason'] ?? null),
                ], JSON_THROW_ON_ERROR),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return $locked->refresh();
        });

        return response()->json($this->present($coupon));
    }

    private function ownerShop(Request $request): Shop
    {
        return $request->user()->shops()->where('status', 'active')->firstOrFail();
    }

    private function expireDueCoupons(): void
    {
        Coupon::query()
            ->whereIn('status', ['pending', 'active'])
            ->where('expires_at', '<=', now())
            ->update(['status' => 'expired', 'updated_at' => now()]);
    }

    private function validateCreate(Request $request): array
    {
        if ($request->filled('code')) {
            $normalizedCode = preg_replace('/\s+/u', '', mb_strtoupper(trim((string) $request->input('code'))));
            abort_unless(is_string($normalizedCode), 422, 'Kupon kodu geçerli metin olmalıdır.');
            $request->merge(['code' => $normalizedCode]);
        }
        $data = $request->validate([
            'code' => ['nullable', 'string', 'min:4', 'max:64', 'regex:/^[\pL\pN_-]+$/u', 'unique:coupons,code'],
            'discount_type' => ['required', Rule::in(['fixed', 'percentage'])],
            'discount_value' => ['required', 'numeric', 'gt:0', 'max:100000000'],
            'max_discount_amount' => ['required_if:discount_type,percentage', 'nullable', 'integer', 'min:1'],
            'min_basket_amount' => ['sometimes', 'integer', 'min:0'],
            'usage_limit' => ['required', 'integer', 'min:1', 'max:100000'],
            'expires_at' => ['required', 'date', 'after:now'],
            'shop_id' => ['sometimes', 'integer', 'exists:shops,id'],
        ], [
            'code.regex' => 'Kupon kodu yalnızca harf, rakam, tire ve alt çizgi içerebilir.',
        ]);
        if ($data['discount_type'] === 'percentage' && $data['discount_value'] > 100) {
            abort(422, 'Yüzde indirim oranı 100 değerini aşamaz.');
        }
        if ($data['discount_type'] === 'fixed' && (float) $data['discount_value'] !== floor((float) $data['discount_value'])) {
            abort(422, 'Sabit indirim tutarı tam TL olmalıdır.');
        }

        return $data;
    }

    private function reservedBudget(array $data): int
    {
        $unitCost = $data['discount_type'] === 'fixed'
            ? (int) $data['discount_value']
            : (int) $data['max_discount_amount'];

        return $unitCost * (int) $data['usage_limit'];
    }

    private function uniqueCode(?string $code): string
    {
        return $code ? mb_strtoupper($code) : 'HT'.Str::upper(Str::random(10));
    }

    private function present(Coupon $coupon): array
    {
        return [
            'id' => (string) $coupon->id,
            'code' => $coupon->code,
            'createdByRole' => $coupon->created_by_role,
            'createdByUserId' => (string) $coupon->created_by_user_id,
            'shopId' => $coupon->shop_id === null ? null : (string) $coupon->shop_id,
            'shopName' => $coupon->shop?->name,
            'createdByName' => $coupon->creator?->name,
            'discountType' => $coupon->discount_type,
            'discountValue' => $coupon->discount_value,
            'maxDiscountAmount' => $coupon->max_discount_amount,
            'minBasketAmount' => $coupon->min_basket_amount,
            'usageLimit' => $coupon->usage_limit,
            'usedCount' => $coupon->used_count,
            'reservedBudget' => $coupon->reserved_budget,
            'status' => $coupon->status,
            'expiresAt' => $coupon->expires_at->toISOString(),
            'usageCount' => $coupon->usages_count ?? null,
        ];
    }
}
