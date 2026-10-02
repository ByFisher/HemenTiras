<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SponsorApprovalRequest as SponsorRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SponsorApprovalController extends Controller
{
    public function create(Request $request)
    {
        $data = $request->validate([
            'kind' => ['required', 'in:campaign,budget,targeting,support'],
            'title' => ['required', 'string', 'max:160'],
            'details' => ['required', 'string', 'max:3000'],
        ]);
        $approval = SponsorRequest::query()->create([
            ...$data,
            'sponsor_user_id' => $request->user()->id,
        ]);

        return response()->json($this->present($approval), 201);
    }

    public function index()
    {
        return response()->json(SponsorRequest::query()->with('sponsor')->latest()->get()->map(
            fn (SponsorRequest $approval) => $this->present($approval),
        ));
    }

    public function supportIndex()
    {
        return response()->json(SponsorRequest::query()->where('kind', 'support')->with('sponsor')->latest()->get()->map(
            fn (SponsorRequest $approval) => $this->presentSupport($approval),
        ));
    }

    public function approve(Request $request, SponsorRequest $requestModel)
    {
        return $this->decide($request, $requestModel, 'approved');
    }

    public function approveSupport(Request $request, SponsorRequest $requestModel)
    {
        abort_unless($requestModel->kind === 'support', 404);

        $this->decide($request, $requestModel, 'approved');

        return response()->json($this->presentSupport($requestModel->refresh()));
    }

    public function reject(Request $request, SponsorRequest $requestModel)
    {
        return $this->decide($request, $requestModel, 'rejected');
    }

    public function rejectSupport(Request $request, SponsorRequest $requestModel)
    {
        abort_unless($requestModel->kind === 'support', 404);

        $this->decide($request, $requestModel, 'rejected');

        return response()->json($this->presentSupport($requestModel->refresh()));
    }

    private function decide(Request $request, SponsorRequest $approval, string $status)
    {
        abort_unless($approval->status === 'pending_approval', 409, 'Bu talep daha önce değerlendirilmiş.');
        DB::transaction(function () use ($request, $approval, $status): void {
            $approval->update([
                'status' => $status,
                'reviewed_by' => $request->user()->id,
                'reviewed_at' => now(),
            ]);
            DB::table('audit_logs')->insert([
                'actor_user_id' => $request->user()->id,
                'action' => "sponsor_request.{$status}",
                'subject_type' => SponsorRequest::class,
                'subject_id' => (string) $approval->id,
                'metadata' => json_encode(['kind' => $approval->kind]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });

        return response()->json($this->present($approval->refresh()));
    }

    private function present(SponsorRequest $approval): array
    {
        return [
            'id' => (string) $approval->id,
            'kind' => $approval->kind,
            'title' => $approval->title,
            'details' => $approval->details,
            'createdAt' => $approval->created_at->toISOString(),
            'status' => match ($approval->status) {
                'approved' => 'Onaylandı',
                'rejected' => 'Reddedildi',
                default => 'Onay Bekliyor',
            },
        ];
    }

    private function presentSupport(SponsorRequest $approval): array
    {
        $data = $this->present($approval);
        $data['status'] = match ($approval->status) {
            'approved' => 'Yanıtlandı',
            'rejected' => 'Reddedildi',
            default => 'Yanıt Bekliyor',
        };

        return $data;
    }
}
