<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StaffReview;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AdminReviewController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::in(['pending_approval', 'approved'])],
        ]);
        $reviews = StaffReview::query()
            ->with(['staff.shop', 'customer'])
            ->when(isset($filters['status']), fn ($query) => $query->where('moderation_status', $filters['status']))
            ->latest()
            ->paginate(min(max($request->integer('per_page', 25), 1), 100));

        return response()->json([
            'data' => $reviews->getCollection()->map(fn (StaffReview $review) => $this->present($review)),
            'meta' => [
                'currentPage' => $reviews->currentPage(),
                'lastPage' => $reviews->lastPage(),
                'perPage' => $reviews->perPage(),
                'total' => $reviews->total(),
            ],
        ]);
    }

    public function approve(Request $request, int $review): JsonResponse
    {
        $updated = DB::transaction(function () use ($request, $review): StaffReview {
            $record = StaffReview::query()->whereKey($review)->lockForUpdate()->firstOrFail();
            abort_unless($record->moderation_status === 'pending_approval', 409, 'Yorum daha önce değerlendirilmiş.');
            $record->update([
                'moderation_status' => 'approved',
                'moderated_by' => $request->user()->id,
                'moderated_at' => now(),
            ]);
            $this->audit($request, 'review.approved', $record);

            return $record->refresh()->load(['staff.shop', 'customer']);
        });

        return response()->json($this->present($updated));
    }

    public function destroy(Request $request, int $review): JsonResponse
    {
        DB::transaction(function () use ($request, $review): void {
            $record = StaffReview::query()->whereKey($review)->lockForUpdate()->firstOrFail();
            $this->audit($request, 'review.deleted', $record);
            $record->delete();
        });

        return response()->json(['message' => 'Yorum silindi.']);
    }

    private function present(StaffReview $review): array
    {
        $parts = preg_split('/\s+/u', trim((string) $review->customer?->name), 2) ?: [''];

        return [
            'id' => (string) $review->id,
            'rating' => (int) $review->rating,
            'comment' => $review->comment,
            'status' => $review->moderation_status,
            'createdAt' => $review->created_at?->toISOString(),
            'customerFirstName' => $parts[0],
            'staffName' => trim(($review->staff?->first_name ?? '').' '.($review->staff?->last_name ?? '')),
            'shopName' => $review->staff?->shop?->name,
        ];
    }

    private function audit(Request $request, string $action, StaffReview $review): void
    {
        DB::table('audit_logs')->insert([
            'actor_user_id' => $request->user()->id,
            'action' => $action,
            'subject_type' => StaffReview::class,
            'subject_id' => (string) $review->id,
            'metadata' => json_encode([
                'rating' => $review->rating,
                'moderation_status' => $review->moderation_status,
            ], JSON_THROW_ON_ERROR),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
