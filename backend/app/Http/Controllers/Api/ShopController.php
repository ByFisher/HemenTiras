<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Shop;
use App\Models\ShopContentSubmission;
use App\Models\ShopService;
use App\Models\ShopStaff;
use App\Models\StaffReview;
use Illuminate\Http\Request;

class ShopController extends Controller
{
    public function profile(Request $request)
    {
        $shop = $this->shop($request);

        return response()->json([
            'id' => (string) $shop->id,
            'name' => $shop->name,
            'phone' => $shop->phone,
            'address' => trim($shop->street.', '.$shop->district.', '.$shop->city, ', '),
            'description' => $shop->description,
            'profileImageUrl' => $shop->profile_image_url,
            'coverImageUrl' => $shop->cover_image_url,
        ]);
    }

    public function hours(Request $request)
    {
        $shop = $this->shop($request);
        $staff = $shop->staff()->orderBy('first_name')->orderBy('last_name')->get();

        return response()->json([
            'workingHours' => $shop->working_hours ?? [],
            'shifts' => $staff->map(fn (ShopStaff $member) => [
                'id' => (string) $member->id,
                'name' => trim($member->first_name.' '.$member->last_name),
                'approvalStatus' => $member->approval_status,
                'workingHours' => $member->working_hours ?? [],
            ])->values(),
        ]);
    }

    public function updateHours(Request $request)
    {
        $days = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
        $data = $request->validate([
            'workingHours' => ['required', 'array', 'size:7'],
            'workingHours.*.day' => ['required', 'string', 'in:'.implode(',', $days)],
            'workingHours.*.enabled' => ['required', 'boolean'],
            'workingHours.*.start' => ['nullable', 'date_format:H:i'],
            'workingHours.*.end' => ['nullable', 'date_format:H:i'],
            'workingHours.*.breakStart' => ['nullable', 'date_format:H:i'],
            'workingHours.*.breakEnd' => ['nullable', 'date_format:H:i'],
        ]);
        $schedule = collect($data['workingHours']);
        abort_if($schedule->pluck('day')->unique()->count() !== count($days), 422, 'Her gün için yalnızca bir çalışma saati tanımlanmalıdır.');

        foreach ($schedule as $day) {
            $start = $day['start'] ?? null;
            $end = $day['end'] ?? null;
            $breakStart = $day['breakStart'] ?? null;
            $breakEnd = $day['breakEnd'] ?? null;

            if ($day['enabled'] && (empty($start) || empty($end) || $start >= $end)) {
                abort(422, 'Açık günler için geçerli bir başlangıç ve bitiş saati girilmelidir.');
            }
            if ((empty($breakStart) xor empty($breakEnd))
                || (! empty($breakStart) && $breakStart >= $breakEnd)) {
                abort(422, 'Mola başlangıç ve bitiş saatleri birlikte ve doğru sırada girilmelidir.');
            }
        }

        $shop = $this->shop($request);
        $shop->update(['working_hours' => $schedule->sortBy(fn (array $day) => array_search($day['day'], $days, true))->values()->all()]);

        return response()->json([
            'workingHours' => $shop->refresh()->working_hours ?? [],
            'shifts' => $shop->staff()->orderBy('first_name')->orderBy('last_name')->get()->map(fn (ShopStaff $member) => [
                'id' => (string) $member->id,
                'name' => trim($member->first_name.' '.$member->last_name),
                'approvalStatus' => $member->approval_status,
                'workingHours' => $member->working_hours ?? [],
            ])->values(),
        ]);
    }

    public function gallery(Request $request)
    {
        $items = $this->shop($request)->contentSubmissions()
            ->where('kind', 'gallery_image')
            ->whereNotNull('file_path')
            ->latest()
            ->limit(100)
            ->get();

        return response()->json($items->map(fn (ShopContentSubmission $item) => $this->submissionData($item))->values());
    }

    public function reviews(Request $request)
    {
        $shop = $this->shop($request);
        $query = StaffReview::query()->whereHas('staff', fn ($staff) => $staff
            ->where('shop_id', $shop->id)
            ->where('approval_status', 'approved'));
        $reviewCount = (clone $query)->count();
        $averageRating = (float) ((clone $query)->avg('rating') ?? 0);
        $reviews = $query->with([
            'staff:id,first_name,last_name',
            'customer:id,name',
        ])->latest()->limit(100)->get();

        return response()->json([
            'averageRating' => $averageRating,
            'reviewCount' => $reviewCount,
            'reviews' => $reviews->map(fn (StaffReview $review) => [
                'id' => (string) $review->id,
                'rating' => $review->rating,
                'comment' => $review->comment,
                'createdAt' => $review->created_at->toISOString(),
                'staffName' => trim($review->staff->first_name.' '.$review->staff->last_name),
                'customerFirstName' => explode(' ', $review->customer->name)[0],
            ])->values(),
        ]);
    }

    public function services(Request $request)
    {
        return response()->json(
            $this->shop($request)->services()->orderBy('sort_order')->get()->map(fn (ShopService $service) => $this->serviceData($service)),
        );
    }

    public function createService(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'category' => ['nullable', 'string', 'max:80'],
            'description' => ['nullable', 'string', 'max:2000'],
            'durationMinutes' => ['required', 'integer', 'min:5', 'max:600'],
            'price' => ['required', 'integer', 'min:0', 'max:1000000'],
            'status' => ['sometimes', 'in:active,inactive'],
        ]);
        $service = $this->shop($request)->services()->create([
            'name' => $data['name'],
            'category' => $data['category'] ?? '',
            'description' => $data['description'] ?? '',
            'duration_minutes' => $data['durationMinutes'],
            'price' => $data['price'],
            'is_active' => ($data['status'] ?? 'active') === 'active',
        ]);

        return response()->json($this->serviceData($service), 201);
    }

    public function updateService(Request $request, ShopService $service)
    {
        abort_unless($service->shop_id === $this->shop($request)->id, 404);
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:120'],
            'category' => ['sometimes', 'nullable', 'string', 'max:80'],
            'description' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'durationMinutes' => ['sometimes', 'required', 'integer', 'min:5', 'max:600'],
            'price' => ['sometimes', 'required', 'integer', 'min:0', 'max:1000000'],
            'status' => ['sometimes', 'in:active,inactive'],
        ]);
        $fields = [
            'name' => 'name',
            'category' => 'category',
            'description' => 'description',
            'durationMinutes' => 'duration_minutes',
            'price' => 'price',
        ];
        $updates = [];
        foreach ($fields as $input => $column) {
            if (array_key_exists($input, $data)) {
                $updates[$column] = $data[$input];
            }
        }
        if (array_key_exists('status', $data)) {
            $updates['is_active'] = $data['status'] === 'active';
        }
        $service->update($updates);

        return response()->json($this->serviceData($service->refresh()));
    }

    public function staff(Request $request)
    {
        return response()->json(
            $this->shop($request)->staff()->latest()->get()->map(fn (ShopStaff $member) => $this->staffData($member)),
        );
    }

    public function createStaff(Request $request)
    {
        $data = $request->validate([
            'firstName' => ['required', 'string', 'max:80'],
            'lastName' => ['required', 'string', 'max:80'],
            'title' => ['required', 'in:Berber,Kalfa,Çırak'],
            'experienceYears' => ['required', 'integer', 'min:0', 'max:80'],
            'biography' => ['nullable', 'string', 'max:3000'],
            'schedule' => ['required', 'array'],
            'schedule.*.day' => ['required', 'string', 'max:20'],
            'schedule.*.enabled' => ['required', 'boolean'],
            'schedule.*.start' => ['nullable', 'date_format:H:i'],
            'schedule.*.end' => ['nullable', 'date_format:H:i'],
            'schedule.*.breakStart' => ['nullable', 'date_format:H:i'],
            'schedule.*.breakEnd' => ['nullable', 'date_format:H:i'],
            'skills' => ['nullable', 'array'],
            'skills.*.name' => ['required', 'string', 'max:100'],
            'skills.*.rating' => ['required', 'integer', 'min:1', 'max:5'],
        ]);
        $member = $this->shop($request)->staff()->create([
            'first_name' => $data['firstName'],
            'last_name' => $data['lastName'],
            'title' => $data['title'],
            'experience_years' => $data['experienceYears'],
            'biography' => $data['biography'] ?? '',
            'approval_status' => 'pending_approval',
            'working_hours' => $data['schedule'],
            'skills' => $data['skills'] ?? [],
            'work_logs' => [],
        ]);
        ShopContentSubmission::query()->create([
            'shop_id' => $member->shop_id,
            'submitted_by' => $request->user()->id,
            'related_entity_id' => $member->id,
            'kind' => 'staff_profile',
            'title' => "{$member->first_name} {$member->last_name} · personel profili",
            'description' => 'Yeni personel profili müşteri tarafında admin onayı sonrası görünür.',
        ]);

        return response()->json($this->staffData($member), 201);
    }

    public function updateStaff(Request $request, ShopStaff $staff)
    {
        abort_unless($staff->shop_id === $this->shop($request)->id, 404);
        $data = $request->validate([
            'firstName' => ['sometimes', 'required', 'string', 'max:80'],
            'lastName' => ['sometimes', 'required', 'string', 'max:80'],
            'title' => ['sometimes', 'required', 'in:Berber,Kalfa,Çırak'],
            'experienceYears' => ['sometimes', 'required', 'integer', 'min:0', 'max:80'],
            'biography' => ['sometimes', 'nullable', 'string', 'max:3000'],
            'schedule' => ['sometimes', 'required', 'array'],
            'skills' => ['sometimes', 'required', 'array'],
            'workLogs' => ['sometimes', 'required', 'array'],
        ]);
        $fields = [
            'firstName' => 'first_name',
            'lastName' => 'last_name',
            'title' => 'title',
            'experienceYears' => 'experience_years',
            'biography' => 'biography',
            'schedule' => 'working_hours',
            'skills' => 'skills',
            'workLogs' => 'work_logs',
        ];
        $updates = [];
        foreach ($fields as $input => $column) {
            if (array_key_exists($input, $data)) {
                $updates[$column] = $data[$input];
            }
        }
        $staff->update($updates);

        return response()->json($this->staffData($staff->refresh()));
    }

    public function submissions(Request $request)
    {
        return response()->json(
            $this->shop($request)->contentSubmissions()->latest()->get()->map(fn (ShopContentSubmission $item) => $this->submissionData($item)),
        );
    }

    public function submitContent(Request $request)
    {
        $data = $request->validate([
            'kind' => ['required', 'in:profile_image,cover_image,staff_profile,staff_photo,shop_information,gallery_image'],
            'title' => ['required', 'string', 'max:160'],
            'description' => ['nullable', 'string', 'max:3000'],
            'payload' => ['prohibited_unless:kind,shop_information', 'required_if:kind,shop_information', 'array'],
            'payload.name' => ['required_if:kind,shop_information', 'string', 'max:120'],
            'payload.phone' => ['required_if:kind,shop_information', 'string', 'max:40'],
            'payload.address' => ['required_if:kind,shop_information', 'string', 'max:1000'],
            'payload.description' => ['nullable', 'string', 'max:1000'],
            'related_entity_id' => ['nullable', 'integer', 'exists:staff,id'],
            'file' => ['required_if:kind,profile_image,cover_image,staff_photo,gallery_image', 'sometimes', 'image', 'max:5120'],
        ]);
        $shop = $this->shop($request);
        if (isset($data['related_entity_id'])) {
            abort_unless($shop->staff()->whereKey($data['related_entity_id'])->exists(), 404);
        }
        $filePath = isset($data['file'])
            ? $request->file('file')->store('shop-submissions', 'local')
            : null;
        $submission = ShopContentSubmission::query()->create([
            'shop_id' => $shop->id,
            'submitted_by' => $request->user()->id,
            'related_entity_id' => $data['related_entity_id'] ?? null,
            'kind' => $data['kind'],
            'title' => $data['title'],
            'description' => $data['description'] ?? '',
            'payload' => $data['payload'] ?? null,
            'file_path' => $filePath,
        ]);
        $submission->update([
            'preview_url' => $filePath
                ? rtrim(config('app.url'), '/').'/api/v1/content-submissions/'.$submission->id.'/preview'
                : null,
        ]);
        $submission->refresh();

        return response()->json($this->submissionData($submission), 201);
    }

    private function shop(Request $request): Shop
    {
        return $request->user()->shops()->firstOrFail();
    }

    private function serviceData(ShopService $service): array
    {
        return [
            'id' => (string) $service->id,
            'shopId' => (string) $service->shop_id,
            'name' => $service->name,
            'category' => $service->category,
            'description' => $service->description,
            'durationMinutes' => $service->duration_minutes,
            'price' => $service->price,
            'isActive' => $service->is_active,
            'status' => $service->is_active ? 'active' : 'inactive',
            'sortOrder' => $service->sort_order,
        ];
    }

    private function staffData(ShopStaff $member): array
    {
        $ratings = $member->reviews()->pluck('rating')->all();

        return [
            'id' => (string) $member->id,
            'shopId' => (string) $member->shop_id,
            'firstName' => $member->first_name,
            'lastName' => $member->last_name,
            'title' => $member->title,
            'experienceYears' => $member->experience_years,
            'biography' => $member->biography,
            'photoUrl' => $member->approval_status === 'approved' ? $member->photo_url : null,
            'approvalStatus' => $member->approval_status,
            'isApproved' => $member->approval_status === 'approved',
            'customerRatings' => $ratings,
            'averageRating' => count($ratings) ? array_sum($ratings) / count($ratings) : 0,
            'ownerRating' => (float) $member->owner_rating,
            'reviewCount' => count($ratings),
            'completedAppointmentCount' => $member->appointments()->where('status', 'completed')->count(),
            'schedule' => $member->working_hours ?? [],
            'workingHours' => $member->working_hours ?? [],
            'skills' => $member->skills ?? [],
            'workLogs' => $member->work_logs ?? [],
        ];
    }

    private function submissionData(ShopContentSubmission $item): array
    {
        return [
            'id' => (string) $item->id,
            'kind' => $item->kind,
            'title' => $item->title,
            'description' => $item->description,
            'previewUrl' => $item->preview_url,
            'relatedEntityId' => $item->related_entity_id ? (string) $item->related_entity_id : null,
            'approvalStatus' => $item->approval_status,
            'isApproved' => $item->approval_status === 'approved',
            'createdAt' => $item->created_at->toISOString(),
            'rejectionReason' => $item->rejection_reason,
        ];
    }
}
