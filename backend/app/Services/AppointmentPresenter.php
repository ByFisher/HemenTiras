<?php

namespace App\Services;

use App\Models\Appointment;

class AppointmentPresenter
{
    public function present(Appointment $appointment): array
    {
        $appointment->loadMissing(['services', 'coupon']);
        $payment = $appointment->payment;

        return [
            'id' => (string) $appointment->id,
            'customerId' => (string) $appointment->customer_id,
            'shopId' => (string) $appointment->shop_id,
            'staffId' => (string) $appointment->staff_id,
            'serviceId' => (string) $appointment->service_id,
            'startsAt' => $appointment->starts_at->toISOString(),
            'endsAt' => $appointment->ends_at->toISOString(),
            'status' => $appointment->status,
            'totalPrice' => $appointment->total_price,
            'basePrice' => $appointment->base_price ?? $appointment->total_price,
            'discountAmount' => $appointment->discount_amount,
            'couponCode' => $appointment->coupon?->code,
            'services' => $appointment->services->map(fn ($service) => [
                'id' => (string) $service->id,
                'name' => $service->pivot->service_name,
                'durationMinutes' => $service->pivot->duration_minutes,
                'price' => $service->pivot->price,
            ])->values(),
            'note' => $appointment->note,
            'cancellationReason' => $appointment->cancellation_reason,
            'cancelledAt' => $appointment->cancelled_at?->toISOString(),
            'isRated' => $appointment->review !== null,
            'payment' => [
                'provider' => $payment?->provider ?? config('payments.driver'),
                'status' => $payment?->status ?? 'unpaid',
                'method' => $payment?->payment_method,
                'amount' => $payment?->amount ?? $appointment->total_price,
                'currency' => $payment?->currency ?? 'TRY',
                'refundAmount' => in_array($payment?->status, ['refund_pending', 'refunded', 'refund_failed'], true)
                    ? $payment->amount
                    : 0,
            ],
            'demoPaymentEnabled' => (bool) config('payments.demo_enabled')
                && config('payments.driver') === 'demo',
            'shop' => $appointment->shop ? [
                'id' => (string) $appointment->shop->id,
                'name' => $appointment->shop->name,
                'coverImageUrl' => $appointment->shop->cover_image_url,
                'address' => ['district' => ['name' => $appointment->shop->district, 'city' => ['name' => $appointment->shop->city]]],
            ] : null,
            'staff' => $appointment->staff ? [
                'id' => (string) $appointment->staff->id,
                'firstName' => $appointment->staff->first_name,
                'lastName' => $appointment->staff->last_name,
                'title' => $appointment->staff->title,
                'photoUrl' => $appointment->staff->photo_url,
            ] : null,
            'service' => $appointment->service ? [
                'id' => (string) $appointment->service->id,
                'name' => $appointment->service->name,
                'durationMinutes' => $appointment->service->duration_minutes,
                'price' => $appointment->service->price,
            ] : null,
            'createdAt' => $appointment->created_at->toISOString(),
        ];
    }
}
