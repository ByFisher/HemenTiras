<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Shop;
use App\Models\ShopService;
use App\Models\ShopStaff;
use App\Models\StaffReview;
use App\Services\LocationCatalog;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PublicShopController extends Controller
{
    public function index(Request $request)
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
            'city' => ['nullable', 'string', 'max:120'],
            'district' => ['nullable', 'string', 'max:120'],
            'service' => ['nullable', 'string', 'max:120'],
            'min_rating' => ['nullable', 'numeric', 'min:0', 'max:5'],
            'sort' => ['nullable', 'in:rating_desc,rating_asc,name_asc,reviews_desc'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);
        $sort = $filters['sort'] ?? 'rating_desc';
        $shops = Shop::query()->where('status', 'active')->where('is_approved', true)
            ->with([
                'services' => fn ($query) => $query->where('is_active', true)->orderBy('sort_order'),
                'staff' => fn ($query) => $query->where('approval_status', 'approved')
                    ->withAvg('reviews', 'rating')->withCount('reviews'),
            ])
            ->when($request->filled('search'), fn ($query) => $query->where('name', 'like', '%'.$request->string('search').'%'))
            ->when(isset($filters['city']), fn ($query) => $query->where('city', $filters['city']))
            ->when(isset($filters['district']), fn ($query) => $query->where('district', $filters['district']))
            ->when($request->filled('service'), function ($query) use ($request): void {
                $query->whereHas('services', fn ($services) => $services->where('is_active', true)
                    ->where('name', 'like', '%'.$request->string('service').'%'));
            })
            ->when($request->filled('min_rating'), function ($query) use ($request): void {
                $minimum = $request->float('min_rating');
                $query->whereIn('shops.id', function ($reviews) use ($minimum): void {
                    $reviews->select('staff.shop_id')
                        ->from('staff_reviews')
                        ->join('staff', 'staff_reviews.staff_id', '=', 'staff.id')
                        ->where('staff.approval_status', 'approved')
                        ->where('staff_reviews.moderation_status', 'approved')
                        ->groupBy('staff.shop_id')
                        ->havingRaw('AVG(staff_reviews.rating) >= ?', [$minimum]);
                });
            })
            ->when($sort === 'name_asc', fn ($query) => $query->orderBy('name'))
            ->when($sort === 'reviews_desc', fn ($query) => $query->orderByRaw($this->reviewCountSql().' DESC'))
            ->when($sort === 'rating_desc', fn ($query) => $query->orderByRaw('COALESCE('.$this->ratingSql().', 0) DESC'))
            ->when($sort === 'rating_asc', fn ($query) => $query->orderByRaw('COALESCE('.$this->ratingSql().', 0) ASC'))
            ->orderBy('shops.id')
            ->paginate(min(max($request->integer('per_page', 24), 1), 100));

        return response()->json([
            'data' => $shops->getCollection()->map(fn (Shop $shop) => $this->shopData($shop, true)),
            'meta' => [
                'currentPage' => $shops->currentPage(),
                'lastPage' => $shops->lastPage(),
                'perPage' => $shops->perPage(),
                'total' => $shops->total(),
            ],
        ]);
    }

    public function show(Shop $shop)
    {
        abort_unless($shop->status === 'active' && $shop->is_approved, 404);

        return response()->json($this->shopData($shop));
    }

    public function showBySlug(string $slug)
    {
        $shop = Shop::query()
            ->where('slug', $slug)
            ->where('status', 'active')
            ->where('is_approved', true)
            ->firstOrFail();

        return response()->json($this->shopData($shop));
    }

    public function services(Shop $shop)
    {
        abort_unless($shop->status === 'active' && $shop->is_approved, 404);

        return response()->json($shop->services()->where('is_active', true)->orderBy('sort_order')->get()
            ->map(fn (ShopService $service) => $this->serviceData($service)));
    }

    public function staff(Shop $shop)
    {
        abort_unless($shop->status === 'active' && $shop->is_approved, 404);

        return response()->json($shop->staff()->where('approval_status', 'approved')->latest()->get()
            ->map(fn (ShopStaff $member) => $this->staffData($member, false)));
    }

    public function staffDetail(Shop $shop, ShopStaff $staff)
    {
        abort_unless($shop->status === 'active' && $shop->is_approved && $staff->shop_id === $shop->id && $staff->approval_status === 'approved', 404);

        return response()->json($this->staffData($staff, true));
    }

    public function reviews(Shop $shop, ShopStaff $staff)
    {
        abort_unless($shop->status === 'active' && $shop->is_approved && $staff->shop_id === $shop->id && $staff->approval_status === 'approved', 404);
        $reviews = $staff->reviews()->with('customer')->latest()->paginate(min(max(request()->integer('per_page', 20), 1), 100));

        return response()->json([
            'data' => $reviews->getCollection()->map(fn (StaffReview $review) => [
                'id' => (string) $review->id,
                'appointmentId' => (string) $review->appointment_id,
                'staffId' => (string) $review->staff_id,
                'customerId' => (string) $review->customer_id,
                'rating' => $review->rating,
                'comment' => $review->comment,
                'createdAt' => $review->created_at->toISOString(),
                'customer' => [
                    'id' => (string) $review->customer_id,
                    'firstName' => explode(' ', $review->customer->name)[0],
                    'maskedSurname' => '***',
                ],
            ]),
            'meta' => [
                'currentPage' => $reviews->currentPage(),
                'lastPage' => $reviews->lastPage(),
                'perPage' => $reviews->perPage(),
                'total' => $reviews->total(),
            ],
        ]);
    }

    public function availability(Request $request, Shop $shop, ShopStaff $staff)
    {
        abort_unless($shop->status === 'active' && $shop->is_approved && $staff->shop_id === $shop->id && $staff->approval_status === 'approved', 404);
        $data = $request->validate([
            'service_id' => ['nullable', 'integer', 'exists:shop_services,id'],
            'service_ids' => ['nullable', 'string', 'max:100'],
            'date' => ['required', 'date_format:Y-m-d', 'after_or_equal:today'],
        ]);
        $serviceIds = isset($data['service_ids'])
            ? array_values(array_unique(explode(',', $data['service_ids'])))
            : (isset($data['service_id']) ? [(string) $data['service_id']] : []);
        abort_if(count($serviceIds) < 1 || count($serviceIds) > 10, 422, 'Bir ile on arasında hizmet seçilmelidir.');
        abort_if(collect($serviceIds)->contains(fn (string $id): bool => ! ctype_digit($id)), 422, 'Hizmet seçimi geçersiz.');
        $services = $shop->services()->whereIn('id', $serviceIds)->where('is_active', true)->get();
        abort_unless($services->count() === count($serviceIds), 404);
        $durationMinutes = (int) $services->sum('duration_minutes');
        $date = CarbonImmutable::parse($data['date']);
        $weekday = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'][$date->dayOfWeek];
        $hours = collect($staff->working_hours ?? [])->firstWhere('day', $weekday);

        if (! $hours || ! ($hours['enabled'] ?? false)) {
            return response()->json([]);
        }

        $start = CarbonImmutable::parse($data['date'].' '.$hours['start']);
        $end = CarbonImmutable::parse($data['date'].' '.$hours['end']);
        $slots = [];
        for ($slot = $start; $slot->addMinutes($durationMinutes)->lte($end); $slot = $slot->addMinutes(15)) {
            $slotEnd = $slot->addMinutes($durationMinutes);
            $breakStart = ! empty($hours['breakStart']) ? CarbonImmutable::parse($data['date'].' '.$hours['breakStart']) : null;
            $breakEnd = ! empty($hours['breakEnd']) ? CarbonImmutable::parse($data['date'].' '.$hours['breakEnd']) : null;
            $overlapsBreak = $breakStart && $breakEnd && $slot < $breakEnd && $slotEnd > $breakStart;
            $overlapsAppointment = $staff->appointments()
                ->whereIn('status', ['pending', 'confirmed'])
                ->where('starts_at', '<', $slotEnd)
                ->where('ends_at', '>', $slot)
                ->exists();
            $slots[] = [
                'startsAt' => $slot->toISOString(),
                'endsAt' => $slotEnd->toISOString(),
                'isAvailable' => ! $overlapsBreak && ! $overlapsAppointment && $slot->isFuture(),
            ];
        }

        return response()->json($slots);
    }

    public function cities(LocationCatalog $locations)
    {
        return response()->json($locations->cities());
    }

    public function districts(Request $request, LocationCatalog $locations)
    {
        $data = $request->validate([
            'city' => ['required', 'string', 'max:120', Rule::in($locations->cities())],
        ]);

        return response()->json($locations->districts($data['city']));
    }

    public function distinctServices()
    {
        $services = ShopService::query()
            ->where('is_active', true)
            ->whereHas('shop', function ($query) {
                $query->where('status', 'active')
                    ->where('is_approved', true);
            })
            ->select('name')
            ->distinct()
            ->orderBy('name')
            ->pluck('name');

        return response()->json($services);
    }

    private function shopData(Shop $shop, bool $includeServices = false): array
    {
        $staff = $shop->relationLoaded('staff')
            ? $shop->staff
            : $shop->staff()->where('approval_status', 'approved')
                ->withAvg('reviews', 'rating')->withCount('reviews')->get();
        $services = $shop->relationLoaded('services')
            ? $shop->services
            : $shop->services()->where('is_active', true)->orderBy('sort_order')->get();

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
            'phone' => $shop->phone ?? '',
            'workingHours' => $shop->working_hours ?? [],
            'averageRating' => (float) $staff->avg('reviews_avg_rating'),
            'reviewCount' => (int) $staff->sum('reviews_count'),
            'minimumServicePrice' => $services->min('price'),
            ...($includeServices ? [
                'services' => $services->map(fn (ShopService $service) => $this->serviceData($service))->values(),
            ] : []),
            'commissionRate' => (float) $shop->commission_rate,
            'createdAt' => $shop->created_at->toISOString(),
        ];
    }

    private function ratingSql(): string
    {
        return "(SELECT AVG(staff_reviews.rating) FROM staff_reviews INNER JOIN staff ON staff_reviews.staff_id = staff.id WHERE staff.shop_id = shops.id AND staff.approval_status = 'approved' AND staff_reviews.moderation_status = 'approved')";
    }

    private function reviewCountSql(): string
    {
        return "(SELECT COUNT(*) FROM staff_reviews INNER JOIN staff ON staff_reviews.staff_id = staff.id WHERE staff.shop_id = shops.id AND staff.approval_status = 'approved' AND staff_reviews.moderation_status = 'approved')";
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
            'sortOrder' => $service->sort_order,
        ];
    }

    private function staffData(ShopStaff $staff, bool $withServices): array
    {
        $ratings = $staff->reviews()->pluck('rating')->all();

        return [
            'id' => (string) $staff->id,
            'shopId' => (string) $staff->shop_id,
            'firstName' => $staff->first_name,
            'lastName' => $staff->last_name,
            'title' => $staff->title,
            'experienceYears' => $staff->experience_years,
            'biography' => $staff->biography,
            'photoUrl' => $staff->photo_url,
            'approvalStatus' => $staff->approval_status,
            'isApproved' => true,
            'averageRating' => count($ratings) ? array_sum($ratings) / count($ratings) : 0,
            'reviewCount' => count($ratings),
            'completedAppointmentCount' => $staff->appointments()->where('status', 'completed')->count(),
            'workingHours' => $staff->working_hours ?? [],
            'services' => $withServices ? $staff->shop->services()->where('is_active', true)->get()->map(fn (ShopService $service) => $this->serviceData($service)) : [],
        ];
    }
}
