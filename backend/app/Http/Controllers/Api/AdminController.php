<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminController extends Controller
{
    public function users(Request $request)
    {
        $users = User::query()
            ->when($request->string('search')->isNotEmpty(), fn ($query) => $query->where('name', 'like', '%'.$request->string('search').'%'))
            ->when($request->string('status')->isNotEmpty(), fn ($query) => $query->where('status', $request->string('status')))
            ->latest()
            ->paginate(min(max($request->integer('per_page', 25), 1), 100));

        return response()->json([
            'data' => $users->getCollection()->map(fn (User $user) => $this->maskedUser($user)),
            'meta' => [
                'currentPage' => $users->currentPage(),
                'lastPage' => $users->lastPage(),
                'perPage' => $users->perPage(),
                'total' => $users->total(),
            ],
        ]);
    }

    public function recentUsers(Request $request)
    {
        $users = User::query()
            ->where('role', 'customer')
            ->when($request->string('search')->isNotEmpty(), fn ($query) => $query->where('name', 'like', '%'.$request->string('search').'%'))
            ->when($request->string('status')->isNotEmpty(), fn ($query) => $query->where('status', $request->string('status')))
            ->latest()
            ->paginate(min(max($request->integer('per_page', 25), 1), 100));

        return response()->json([
            'data' => $users->getCollection()->map(fn (User $user) => $this->maskedUser($user)),
            'meta' => [
                'currentPage' => $users->currentPage(),
                'lastPage' => $users->lastPage(),
                'perPage' => $users->perPage(),
                'total' => $users->total(),
            ],
        ]);
    }

    public function setUserStatus(Request $request, User $user)
    {
        $data = $request->validate(['status' => ['required', 'in:active,suspended']]);
        abort_unless(
            ! in_array($user->role, ['super_admin', 'admin', 'moderator'], true)
                || $request->user()->role === 'super_admin',
            403,
            'Yönetici hesaplarını yalnızca Süper Admin yönetebilir.',
        );
        DB::transaction(function () use ($request, $user, $data): void {
            $user = User::query()->lockForUpdate()->findOrFail($user->id);
            if ($user->role === 'super_admin' && $user->status === 'active' && $data['status'] === 'suspended') {
                $activeSuperAdmins = User::query()
                    ->where('role', 'super_admin')
                    ->where('status', 'active')
                    ->lockForUpdate()
                    ->count();
                abort_if($activeSuperAdmins <= 1, 409, 'Son aktif Süper Admin hesabı askıya alınamaz.');
            }
            $user->update($data);
            $this->audit($request, 'user.status_changed', User::class, $user->id);
        });

        return response()->json($this->maskedUser($user->refresh()));
    }

    public function setShopStatus(Request $request, Shop $shop)
    {
        $data = $request->validate(['status' => ['required', 'in:active,suspended']]);
        abort_unless($shop->owner_user_id, 409, 'Bu dükkanın sahibi tanımlı değil.');

        DB::transaction(function () use ($request, $shop, $data): void {
            $shop->update([
                ...$data,
                ...($data['status'] === 'active' ? ['is_approved' => true] : []),
            ]);
            $shop->owner()->update([
                'status' => $data['status'] === 'active' ? 'approved' : 'suspended',
            ]);
            $this->audit($request, 'shop.status_changed', Shop::class, $shop->id);
        });

        return response()->json($this->shopData($shop->refresh()));
    }

    public function shops(Request $request)
    {
        $shops = Shop::query()
            ->when($request->string('search')->isNotEmpty(), fn ($query) => $query->where('name', 'like', '%'.$request->string('search').'%'))
            ->when($request->string('status')->isNotEmpty(), fn ($query) => $query->where('status', $request->string('status')))
            ->when($request->string('city')->isNotEmpty(), fn ($query) => $query->where('city', 'like', '%'.$request->string('city').'%'))
            ->withCount('appointments')
            ->latest()
            ->paginate(min(max($request->integer('per_page', 25), 1), 100));

        return $this->paginated($shops, fn (Shop $shop) => $this->shopData($shop));
    }

    public function pendingApprovals(Request $request)
    {
        $shops = Shop::query()
            ->where('status', 'pending_approval')
            ->where('is_approved', false)
            ->when($request->string('search')->isNotEmpty(), fn ($query) => $query->where('name', 'like', '%'.$request->string('search').'%'))
            ->withCount('appointments')
            ->latest()
            ->paginate(min(max($request->integer('per_page', 25), 1), 100));

        return $this->paginated($shops, fn (Shop $shop) => $this->shopData($shop));
    }

    public function sponsors(Request $request)
    {
        $sponsors = User::query()
            ->where('role', 'sponsor')
            ->when($request->string('search')->isNotEmpty(), fn ($query) => $query->where('name', 'like', '%'.$request->string('search').'%'))
            ->when($request->string('status')->isNotEmpty(), fn ($query) => $query->where('status', $request->string('status')))
            ->latest()
            ->paginate(min(max($request->integer('per_page', 25), 1), 100));

        return $this->paginated($sponsors, fn (User $user) => [
            'id' => (string) $user->id,
            'companyName' => $user->name,
            'contactName' => $user->name,
            'email' => $user->email,
            'status' => $user->status,
            'dailyBudget' => 0,
            'createdAt' => $user->created_at->toISOString(),
        ]);
    }

    public function directory(Request $request)
    {
        $data = $request->validate(['entity_type' => ['required', 'in:customers,shops,sponsors']]);
        $records = match ($data['entity_type']) {
            'shops' => Shop::query()
                ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
                ->when($request->filled('location'), fn ($query) => $query->where(
                    fn ($location) => $location->where('city', 'like', '%'.$request->string('location').'%')
                        ->orWhere('district', 'like', '%'.$request->string('location').'%'),
                ))
                ->when($request->filled('search'), fn ($query) => $query->where('name', 'like', '%'.$request->string('search').'%'))
                ->latest()->get()->map(fn (Shop $shop) => [
                    'id' => (string) $shop->id, 'title' => $shop->name,
                    'subtitle' => $shop->district.' · '.$shop->city, 'fields' => [],
                    'status' => $this->statusLabel($shop->status), 'entityType' => 'shops',
                ]),
            'sponsors' => User::query()->where('role', 'sponsor')
                ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
                ->when($request->filled('search'), fn ($query) => $query->where('name', 'like', '%'.$request->string('search').'%'))
                ->latest()->get()->map(fn (User $user) => [
                    'id' => (string) $user->id, 'title' => $user->name,
                    'subtitle' => $this->maskEmail($user->email), 'fields' => [],
                    'status' => $this->statusLabel($user->status), 'entityType' => 'sponsors',
                ]),
            default => User::query()->whereIn('role', ['customer', 'staff', 'shop_owner'])
                ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
                ->when($request->filled('search'), fn ($query) => $query->where('name', 'like', '%'.$request->string('search').'%'))
                ->latest()->get()->map(fn (User $user) => [
                    'id' => (string) $user->id, 'title' => $this->maskedUser($user)['firstName'].' '.$this->maskedUser($user)['maskedSurname'],
                    'subtitle' => $this->maskEmail($user->email), 'fields' => [],
                    'status' => $this->statusLabel($user->status), 'entityType' => 'customers',
                ]),
        };

        return response()->json($records);
    }

    private function maskedUser(User $user): array
    {
        $parts = preg_split('/\s+/u', trim($user->name), 2) ?: [$user->name];
        $surname = $parts[1] ?? '';

        return [
            'id' => (string) $user->id,
            'firstName' => $parts[0],
            'maskedSurname' => $surname === '' ? '' : mb_substr($surname, 0, 1).'***',
            'maskedEmail' => $this->maskEmail($user->email),
            'maskedPhone' => $this->maskPhone($user->phone),
            'role' => $user->role,
            'status' => $user->status,
            'createdAt' => $user->created_at->toISOString(),
        ];
    }

    private function maskEmail(string $email): string
    {
        [$name, $domain] = array_pad(explode('@', $email, 2), 2, '');

        return mb_substr($name, 0, 1).'***@'.$domain;
    }

    private function maskPhone(?string $phone): string
    {
        if (! $phone) {
            return '—';
        }

        $digits = preg_replace('/\D+/', '', $phone) ?? '';

        return mb_substr($digits, 0, 3).' *** ** '.mb_substr($digits, -2);
    }

    private function shopData(Shop $shop): array
    {
        return [
            'id' => (string) $shop->id,
            'slug' => $shop->slug,
            'name' => $shop->name,
            'description' => $shop->description,
            'status' => $shop->status,
            'isApproved' => $shop->is_approved,
            'coverImageUrl' => $shop->cover_image_url,
            'profileImageUrl' => $shop->profile_image_url,
            'address' => [
                'district' => ['id' => $shop->district, 'name' => $shop->district, 'city' => ['id' => $shop->city, 'name' => $shop->city, 'plateCode' => '']],
                'street' => $shop->street,
                'fullAddress' => trim($shop->street.', '.$shop->district.', '.$shop->city, ', '),
                'latitude' => null,
                'longitude' => null,
            ],
            'phone' => $this->maskPhone($shop->phone),
            'workingHours' => $shop->working_hours ?? [],
            'averageRating' => 0,
            'reviewCount' => 0,
            'commissionRate' => (float) $shop->commission_rate,
            'createdAt' => $shop->created_at->toISOString(),
        ];
    }

    private function paginated($paginator, callable $map)
    {
        return response()->json([
            'data' => $paginator->getCollection()->map($map),
            'meta' => [
                'currentPage' => $paginator->currentPage(),
                'lastPage' => $paginator->lastPage(),
                'perPage' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    private function statusLabel(string $status): string
    {
        return match ($status) {
            'active', 'approved' => 'Aktif',
            'suspended' => 'Askıda',
            'pending_approval' => 'Onay Bekliyor',
            default => $status,
        };
    }

    private function audit(Request $request, string $action, string $type, int $id): void
    {
        DB::table('audit_logs')->insert([
            'actor_user_id' => $request->user()->id,
            'action' => $action,
            'subject_type' => $type,
            'subject_id' => (string) $id,
            'metadata' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
