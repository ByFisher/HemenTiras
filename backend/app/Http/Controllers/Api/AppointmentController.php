<?php

namespace App\Http\Controllers\Api;

use App\Contracts\PaymentGateway;
use App\Exceptions\PaymentGatewayException;
use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\AppointmentPayment;
use App\Models\Shop;
use App\Models\ShopService;
use App\Models\ShopStaff;
use App\Models\StaffReview;
use App\Services\AppointmentCancellationService;
use App\Services\AppointmentPresenter;
use App\Services\CouponService;
use App\Services\FinancialLedger;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AppointmentController extends Controller
{
    public function index(Request $request)
    {
        $status = $request->string('status')->value();
        $appointments = $request->user()->appointments()->with(['shop', 'staff', 'service', 'review', 'payment'])
            ->when(in_array($status, ['pending', 'confirmed', 'completed', 'cancelled', 'cancelled_by_shop', 'no_show'], true), fn ($query) => $query->where('status', $status))
            ->when($status === 'upcoming', fn ($query) => $query->where(function ($upcoming): void {
                $upcoming->where(function ($active): void {
                    $active->whereIn('status', ['pending', 'confirmed'])->where('starts_at', '>=', now());
                })->orWhere(function ($cancelled): void {
                    $cancelled->whereIn('status', ['cancelled', 'cancelled_by_shop'])->where('updated_at', '>=', now()->subDays(7));
                });
            }))
            ->when($status === 'past', fn ($query) => $query->where('starts_at', '<', now()))
            ->orderByDesc('starts_at')->get();

        return response()->json($appointments->map(fn (Appointment $appointment) => $this->present($appointment)));
    }

    public function active(Request $request)
    {
        $appointments = $request->user()->appointments()
            ->with(['shop', 'staff', 'service', 'review', 'payment'])
            ->where(function ($query): void {
                $query->where(function ($upcoming): void {
                    $upcoming->whereIn('status', ['pending', 'confirmed'])
                        ->where('starts_at', '>=', now());
                })->orWhere(function ($recent): void {
                    $recent->whereIn('status', ['completed', 'cancelled', 'cancelled_by_shop', 'no_show'])
                        ->where('updated_at', '>=', now()->subDays(7));
                });
            })
            ->orderByDesc('starts_at')
            ->limit(50)
            ->get();

        return response()->json($appointments->map(fn (Appointment $appointment) => $this->present($appointment)));
    }

    public function create(Request $request, CouponService $coupons)
    {
        $data = $request->validate([
            'shopId' => ['required', 'integer', 'exists:shops,id'],
            'staffId' => ['required', 'integer', 'exists:staff,id'],
            'serviceId' => ['required_without:serviceIds', 'integer', 'exists:shop_services,id'],
            'serviceIds' => ['sometimes', 'array', 'min:1', 'max:10'],
            'serviceIds.*' => ['required', 'integer', 'distinct', 'exists:shop_services,id'],
            'startsAt' => ['required', 'date', 'after:now'],
            'note' => ['nullable', 'string', 'max:1000'],
            'couponCode' => ['nullable', 'string', 'max:64'],
            'paymentMethod' => ['sometimes', Rule::in(['card', 'at_shop_card', 'cash'])],
        ]);
        $serviceIds = array_values(array_unique(array_map(
            'intval',
            $data['serviceIds'] ?? [$data['serviceId']],
        )));
        $shop = Shop::query()->whereKey($data['shopId'])
            ->where('status', 'active')->where('is_approved', true)->firstOrFail();
        $staff = ShopStaff::query()->whereKey($data['staffId'])->where('shop_id', $shop->id)
            ->where('approval_status', 'approved')->firstOrFail();
        $services = $shop->services()->whereIn('id', $serviceIds)->where('is_active', true)->get();
        abort_unless($services->count() === count($serviceIds), 404);
        $service = $services->firstWhere('id', $serviceIds[0]);
        abort_unless($service, 404);
        $basePrice = (int) $services->sum('price');
        $totalDuration = (int) $services->sum('duration_minutes');
        $start = Carbon::parse($data['startsAt'])->setTimezone(config('app.timezone'));
        $end = $start->copy()->addMinutes($totalDuration);
        abort_unless($this->isWithinWorkingHours($staff, $start, $end), 422, 'Seçilen saat personelin çalışma planına uygun değil.');

        $appointment = DB::transaction(function () use ($request, $shop, $staff, $service, $services, $serviceIds, $basePrice, $start, $end, $data, $coupons): Appointment {
            ShopStaff::query()->whereKey($staff->id)->lockForUpdate()->firstOrFail();
            $overlap = Appointment::query()->where('staff_id', $staff->id)
                ->whereIn('status', ['pending', 'confirmed'])
                ->where('starts_at', '<', $end)
                ->where('ends_at', '>', $start)
                ->exists();
            abort_if($overlap, 409, 'Bu saat için personelin başka bir randevusu var.');

            $appointment = Appointment::query()->create([
                'customer_id' => $request->user()->id,
                'shop_id' => $shop->id,
                'staff_id' => $staff->id,
                'service_id' => $service->id,
                'starts_at' => $start,
                'ends_at' => $end,
                'status' => 'pending',
                'base_price' => $basePrice,
                'discount_amount' => 0,
                'total_price' => $basePrice,
                'note' => $data['note'] ?? null,
            ]);

            $appointment->services()->attach($services->sortBy(fn (ShopService $item) => array_search((int) $item->id, $serviceIds, true))->mapWithKeys(
                fn (ShopService $item, int $index) => [
                    $item->id => [
                        'service_name' => $item->name,
                        'duration_minutes' => $item->duration_minutes,
                        'price' => $item->price,
                        'sort_order' => array_search((int) $item->id, $serviceIds, true),
                    ],
                ],
            )->all());

            if (! empty($data['couponCode'])) {
                $quote = $coupons->quote($data['couponCode'], $shop, $basePrice);
                $discount = $coupons->reserveForAppointment(
                    $quote['coupon'],
                    $shop,
                    $basePrice,
                    $appointment,
                    $request->user()->id,
                );
                $appointment->update([
                    'coupon_id' => $quote['coupon']->id,
                    'discount_amount' => $discount,
                    'total_price' => $basePrice - $discount,
                ]);
            }

            if (isset($data['paymentMethod'])) {
                $isCard = $data['paymentMethod'] === 'card';
                $provider = $isCard ? (string) config('payments.driver') : 'offline';
                $appointment->payment()->create([
                    'provider' => $provider,
                    'payment_method' => $isCard
                        ? (config('payments.driver') === 'demo' ? 'demo' : 'iyzico_checkout_form')
                        : $data['paymentMethod'],
                    'amount' => $appointment->total_price,
                    'currency' => 'TRY',
                    'status' => 'pending',
                    'payment_status' => 'pending',
                    'user_id' => $request->user()->id,
                    'shop_id' => $shop->id,
                    'discount_amount' => $appointment->discount_amount,
                    'coupon_id' => $appointment->coupon_id,
                ]);
            }

            return $appointment->refresh();
        });

        return response()->json($this->present($appointment->load(['shop', 'staff', 'service', 'services', 'review', 'payment', 'coupon'])), 201);
    }

    public function show(Request $request, Appointment $appointment)
    {
        abort_unless($appointment->customer_id === $request->user()->id, 404);

        return response()->json($this->present($appointment->load(['shop', 'staff', 'service', 'review', 'payment'])));
    }

    public function cancel(Request $request, Appointment $appointment, AppointmentCancellationService $cancellation)
    {
        abort_unless($appointment->customer_id === $request->user()->id, 404);
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:500']]);
        $result = $cancellation->cancel($appointment, $request->user(), $data['reason'] ?? null);

        if ($result['refundFailed']) {
            return response()->json([
                'message' => 'Randevu iptal edildi ancak iade sağlayıcısı isteği tamamlayamadı. İade aynı kayıt üzerinden tekrar denenebilir.',
                'appointment' => $this->present($result['appointment']),
            ], 502);
        }

        return response()->json($this->present($result['appointment']));
    }

    public function demoPayment(
        Request $request,
        Appointment $appointment,
        PaymentGateway $gateway,
        AppointmentCancellationService $cancellation,
        FinancialLedger $ledger,
    ) {
        abort_unless((bool) config('payments.demo_enabled') && config('payments.driver') === 'demo', 404);
        abort_unless($appointment->customer_id === $request->user()->id, 404);

        $payment = DB::transaction(function () use ($appointment): AppointmentPayment {
            $locked = Appointment::query()->whereKey($appointment->id)->lockForUpdate()->firstOrFail();
            abort_unless(in_array($locked->status, ['pending', 'confirmed'], true), 409, 'İptal edilmiş veya tamamlanmış randevu için ödeme yapılamaz.');
            $payment = $locked->payment()->lockForUpdate()->first();
            if ($payment?->status === 'paid') {
                return $payment;
            }
            abort_if($payment && $payment->status !== 'pending', 409, 'Bu ödeme yeniden tahsil edilemez.');

            return $payment ?? $locked->payment()->create([
                'provider' => 'demo',
                'payment_method' => 'demo',
                'amount' => $locked->total_price,
                'currency' => 'TRY',
                'status' => 'pending',
                'payment_status' => 'pending',
                'user_id' => $locked->customer_id,
                'shop_id' => $locked->shop_id,
                'discount_amount' => $locked->discount_amount,
                'coupon_id' => $locked->coupon_id,
            ]);
        });

        if ($payment->status === 'pending') {
            try {
                $providerPaymentId = $gateway->capture($payment);
            } catch (PaymentGatewayException) {
                AppointmentPayment::query()
                    ->whereKey($payment->id)
                    ->where('status', 'pending')
                    ->update(['failure_code' => 'gateway_error', 'updated_at' => now()]);

                return response()->json(['message' => 'Demo ödeme sağlayıcısı tahsilatı tamamlayamadı. Aynı ödeme güvenle yeniden denenebilir.'], 502);
            }

            $payment = DB::transaction(function () use ($appointment, $payment, $providerPaymentId, $ledger): AppointmentPayment {
                $lockedAppointment = Appointment::query()->whereKey($appointment->id)->lockForUpdate()->firstOrFail();
                $lockedPayment = AppointmentPayment::query()->whereKey($payment->id)->lockForUpdate()->firstOrFail();
                if ($lockedPayment->status === 'pending') {
                    $lockedPayment->update([
                        'status' => 'paid',
                        'payment_status' => 'paid',
                        'provider_payment_id' => $providerPaymentId,
                        'transaction_id' => $providerPaymentId,
                        'paid_at' => now(),
                        'failure_code' => null,
                    ]);
                    $ledger->recordPayment($lockedPayment->refresh());
                    DB::table('audit_logs')->insert([
                        'actor_user_id' => $appointment->customer_id,
                        'action' => 'appointment.payment_captured',
                        'subject_type' => Appointment::class,
                        'subject_id' => (string) $appointment->id,
                        'metadata' => json_encode([
                            'payment_id' => $lockedPayment->id,
                            'amount' => $lockedPayment->amount,
                            'currency' => $lockedPayment->currency,
                            'provider' => $lockedPayment->provider,
                        ], JSON_THROW_ON_ERROR),
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
                if (in_array($lockedAppointment->status, ['cancelled', 'cancelled_by_shop'], true) && $lockedPayment->status === 'paid') {
                    $lockedPayment->update([
                        'status' => 'refund_pending',
                        'payment_status' => 'refund_pending',
                        'refund_idempotency_key' => (string) Str::uuid(),
                    ]);
                }

                return $lockedPayment->refresh();
            });
        }

        $appointment->refresh()->load(['shop', 'staff', 'service', 'review', 'payment']);
        if (in_array($appointment->status, ['cancelled', 'cancelled_by_shop'], true) && $appointment->payment?->status === 'refund_pending') {
            $refund = $cancellation->cancel($appointment, $request->user(), $appointment->cancellation_reason);
            if ($refund['refundFailed']) {
                return response()->json([
                    'message' => 'Demo tahsilat gerçekleşti ancak iptal edilen randevunun iadesi tamamlanamadı.',
                    'appointment' => $this->present($refund['appointment']),
                ], 502);
            }
            $appointment = $refund['appointment'];
        }

        return response()->json($this->present($appointment));
    }

    public function review(Request $request, Appointment $appointment)
    {
        abort_unless($appointment->customer_id === $request->user()->id, 404);
        abort_unless($appointment->status === 'completed', 409, 'Yalnızca tamamlanmış randevular değerlendirilebilir.');
        $data = $request->validate([
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'comment' => ['nullable', 'string', 'max:2000'],
        ]);
        $review = DB::transaction(function () use ($request, $appointment, $data): StaffReview {
            $locked = Appointment::query()->whereKey($appointment->id)->lockForUpdate()->firstOrFail();
            abort_unless($locked->customer_id === $request->user()->id && $locked->status === 'completed', 409, 'Yalnızca tamamlanmış randevular değerlendirilebilir.');
            abort_if(
                StaffReview::query()->where('appointment_id', $locked->id)->exists(),
                409,
                'Bu randevu için değerlendirme zaten gönderilmiş.',
            );

            return StaffReview::query()->create([
                'appointment_id' => $locked->id,
                'staff_id' => $locked->staff_id,
                'customer_id' => $locked->customer_id,
                ...$data,
                'moderation_status' => 'pending_approval',
            ]);
        });

        return response()->json([
            'id' => (string) $review->id,
            'appointmentId' => (string) $review->appointment_id,
            'staffId' => (string) $review->staff_id,
            'customerId' => (string) $review->customer_id,
            'rating' => $review->rating,
            'comment' => $review->comment,
            'status' => $review->moderation_status,
            'createdAt' => $review->created_at->toISOString(),
        ], 201);
    }

    private function present(Appointment $appointment): array
    {
        return app(AppointmentPresenter::class)->present($appointment->loadMissing('payment'));
    }

    private function isWithinWorkingHours(ShopStaff $staff, Carbon $start, Carbon $end): bool
    {
        $weekday = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'][$start->dayOfWeek];
        $hours = collect($staff->working_hours ?? [])->firstWhere('day', $weekday);
        if (! $hours || ! ($hours['enabled'] ?? false) || empty($hours['start']) || empty($hours['end'])) {
            return false;
        }

        $shiftStart = $start->copy()->setTimeFromTimeString($hours['start']);
        $shiftEnd = $start->copy()->setTimeFromTimeString($hours['end']);
        if ($start < $shiftStart || $end > $shiftEnd || $shiftStart->diffInMinutes($start) % 15 !== 0) {
            return false;
        }

        if (! empty($hours['breakStart']) && ! empty($hours['breakEnd'])) {
            $breakStart = $start->copy()->setTimeFromTimeString($hours['breakStart']);
            $breakEnd = $start->copy()->setTimeFromTimeString($hours['breakEnd']);
            if ($start < $breakEnd && $end > $breakStart) {
                return false;
            }
        }

        return true;
    }
}
