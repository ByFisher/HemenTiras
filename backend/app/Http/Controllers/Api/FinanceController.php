<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FinancialLog;
use App\Services\FinancialLedger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FinanceController extends Controller
{
    public function adminIndex(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'type' => ['nullable', 'in:payment,refund,commission,coupon_discount'],
            'shop_id' => ['nullable', 'integer', 'exists:shops,id'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);
        $logs = FinancialLog::query()->with(['shop:id,name', 'user:id,name'])
            ->when(isset($filters['type']), fn ($query) => $query->where('type', $filters['type']))
            ->when(isset($filters['shop_id']), fn ($query) => $query->where('shop_id', $filters['shop_id']))
            ->when(isset($filters['from']), fn ($query) => $query->where('created_at', '>=', $filters['from'].' 00:00:00'))
            ->when(isset($filters['to']), fn ($query) => $query->where('created_at', '<=', $filters['to'].' 23:59:59'))
            ->latest()
            ->paginate(min(max($request->integer('per_page', 50), 1), 100));

        return $this->page($logs);
    }

    public function shopIndex(Request $request, FinancialLedger $ledger): JsonResponse
    {
        $shop = $request->user()->shops()->where('status', 'active')->firstOrFail();
        $logs = $shop->financialLogs()->with(['shop:id,name', 'user:id,name'])->latest()
            ->paginate(min(max($request->integer('per_page', 50), 1), 100));
        $page = $this->page($logs, true)->getData(true);
        $page['availableBalance'] = $ledger->availableBalance($shop);

        return response()->json($page);
    }

    private function page($paginator, bool $hideCustomerNames = false): JsonResponse
    {
        return response()->json([
            'data' => $paginator->getCollection()->map(fn (FinancialLog $log) => [
                'id' => (string) $log->id,
                'shopId' => $log->shop_id === null ? null : (string) $log->shop_id,
                'shopName' => $log->shop?->name,
                'userId' => $log->user_id === null ? null : (string) $log->user_id,
                'userName' => $hideCustomerNames ? null : $log->user?->name,
                'type' => $log->type,
                'amount' => (float) $log->amount,
                'description' => $log->description,
                'createdAt' => $log->created_at->toISOString(),
            ]),
            'meta' => [
                'currentPage' => $paginator->currentPage(),
                'lastPage' => $paginator->lastPage(),
                'perPage' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }
}
