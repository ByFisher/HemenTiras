<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ShopContentSubmission;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ContentApprovalController extends Controller
{
    public function preview(Request $request, ShopContentSubmission $submission)
    {
        if ($submission->approval_status !== 'approved') {
            $user = $request->user();
            abort_unless($user && (
                $user->role === 'super_admin'
                || $submission->shop()->where('owner_user_id', $user->id)->exists()
            ), 404);
        }
        abort_unless($submission->file_path && Storage::disk('local')->exists($submission->file_path), 404);

        return response()->file(Storage::disk('local')->path($submission->file_path));
    }

    public function index(Request $request)
    {
        return response()->json(
            ShopContentSubmission::query()->with('shop')
                ->when(in_array($request->string('status')->value(), ['pending_approval', 'approved', 'rejected'], true),
                    fn ($query) => $query->where('approval_status', $request->string('status')))
                ->latest()
                ->get()->map(fn (ShopContentSubmission $item) => $this->present($item)),
        );
    }

    public function approve(Request $request, ShopContentSubmission $submission)
    {
        return $this->decide($request, $submission, 'approved');
    }

    public function reject(Request $request, ShopContentSubmission $submission)
    {
        $data = $request->validate(['rejection_reason' => ['required', 'string', 'min:3', 'max:1000']]);

        return $this->decide($request, $submission, 'rejected', $data['rejection_reason']);
    }

    private function decide(Request $request, ShopContentSubmission $submission, string $decision, ?string $reason = null)
    {
        abort_unless($submission->approval_status === 'pending_approval', 409, 'Bu içerik daha önce değerlendirilmiş.');

        DB::transaction(function () use ($request, $submission, $decision, $reason): void {
            $submission->update([
                'approval_status' => $decision,
                'rejection_reason' => $reason,
                'reviewed_by' => $request->user()->id,
                'reviewed_at' => now(),
            ]);

            if ($submission->kind === 'staff_profile' && $submission->related_entity_id) {
                $submission->shop->staff()->whereKey($submission->related_entity_id)->update(['approval_status' => $decision]);
            } elseif ($decision === 'approved' && $submission->kind === 'staff_photo' && $submission->related_entity_id) {
                $submission->shop->staff()->whereKey($submission->related_entity_id)->update(['photo_url' => $submission->preview_url]);
            } elseif ($decision === 'approved' && $submission->kind === 'profile_image') {
                $submission->shop->update(['profile_image_url' => $submission->preview_url]);
            } elseif ($decision === 'approved' && $submission->kind === 'cover_image') {
                $submission->shop->update(['cover_image_url' => $submission->preview_url]);
            } elseif ($decision === 'approved' && $submission->kind === 'shop_information') {
                $payload = validator($submission->payload ?? [], [
                    'name' => ['required', 'string', 'max:120'],
                    'phone' => ['required', 'string', 'max:40'],
                    'address' => ['required', 'string', 'max:1000'],
                    'description' => ['nullable', 'string', 'max:1000'],
                ])->validate();
                $submission->shop->update([
                    'name' => $payload['name'],
                    'phone' => $payload['phone'],
                    'street' => $payload['address'],
                    'description' => $payload['description'] ?? '',
                ]);
            }

            DB::table('audit_logs')->insert([
                'actor_user_id' => $request->user()->id,
                'action' => "content_submission.{$decision}",
                'subject_type' => ShopContentSubmission::class,
                'subject_id' => (string) $submission->id,
                'metadata' => json_encode(['rejection_reason' => $reason]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });

        return response()->json($this->present($submission->refresh()->load('shop')));
    }

    private function present(ShopContentSubmission $item): array
    {
        return [
            'id' => (string) $item->id,
            'kind' => $item->kind,
            'title' => $item->title,
            'description' => $item->description,
            'previewUrl' => $item->preview_url,
            'relatedEntityId' => $item->related_entity_id ? (string) $item->related_entity_id : null,
            'shopId' => (string) $item->shop_id,
            'shopName' => $item->shop?->name,
            'approvalStatus' => $item->approval_status,
            'status' => $item->approval_status,
            'isApproved' => $item->approval_status === 'approved',
            'submittedAt' => $item->created_at->toISOString(),
            'createdAt' => $item->created_at->toISOString(),
            'rejectionReason' => $item->rejection_reason,
        ];
    }
}
