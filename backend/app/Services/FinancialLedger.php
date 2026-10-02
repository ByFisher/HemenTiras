<?php

namespace App\Services;

use App\Models\AppointmentPayment;
use App\Models\FinancialLog;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class FinancialLedger
{
    public function recordPayment(AppointmentPayment $payment): void
    {
        $payment->loadMissing('appointment.shop');
        $appointment = $payment->appointment;
        $shop = $appointment?->shop;
        if (! $appointment || ! $shop) {
            throw new \LogicException('A financial payment must be linked to an appointment and shop.');
        }

        DB::transaction(function () use ($payment, $appointment, $shop): void {
            $this->record([
                'shop_id' => $shop->id,
                'user_id' => $appointment->customer_id,
                'type' => 'payment',
                'amount' => $payment->amount,
                'description' => "Randevu #{$appointment->id} tahsilatı",
                'source_type' => AppointmentPayment::class,
                'source_id' => $payment->id.':payment',
            ]);

            $commission = (int) round($payment->amount * $shop->commission_rate / 100);
            if ($commission > 0) {
                $this->record([
                    'shop_id' => $shop->id,
                    'user_id' => $appointment->customer_id,
                    'type' => 'commission',
                    'amount' => -$commission,
                    'description' => "Randevu #{$appointment->id} platform komisyonu",
                    'source_type' => AppointmentPayment::class,
                    'source_id' => $payment->id.':commission',
                ]);
            }

            if ($payment->discount_amount > 0 && $payment->coupon_id) {
                $this->record([
                    'shop_id' => $shop->id,
                    'user_id' => $appointment->customer_id,
                    'type' => 'coupon_discount',
                    'amount' => -$payment->discount_amount,
                    'description' => "Randevu #{$appointment->id} kupon indirimi (ledger raporlama kalemi)",
                    'source_type' => AppointmentPayment::class,
                    'source_id' => $payment->id.':coupon',
                ]);
            }
        });
    }

    public function recordRefund(AppointmentPayment $payment, User $actor): void
    {
        $payment->loadMissing('appointment.shop');
        $appointment = $payment->appointment;
        $shop = $appointment?->shop;
        if (! $appointment || ! $shop) {
            throw new \LogicException('A financial refund must be linked to an appointment and shop.');
        }

        DB::transaction(function () use ($payment, $appointment, $shop, $actor): void {
            $this->record([
                'shop_id' => $shop->id,
                'user_id' => $actor->id,
                'type' => 'refund',
                'amount' => -$payment->amount,
                'description' => "Randevu #{$appointment->id} iadesi",
                'source_type' => AppointmentPayment::class,
                'source_id' => $payment->id.':refund',
            ]);

            $commission = (int) round($payment->amount * $shop->commission_rate / 100);
            if ($commission > 0) {
                $this->record([
                    'shop_id' => $shop->id,
                    'user_id' => $actor->id,
                    'type' => 'commission',
                    'amount' => $commission,
                    'description' => "Randevu #{$appointment->id} iade edilen platform komisyonu",
                    'source_type' => AppointmentPayment::class,
                    'source_id' => $payment->id.':commission_refund',
                ]);
            }
        });
    }

    public function availableBalance(Shop $shop, ?int $excludeCouponId = null): int
    {
        $cashBalance = (int) $shop->financialLogs()
            ->whereIn('type', ['payment', 'refund', 'commission'])
            ->sum('amount');

        $reserved = (int) DB::table('coupons')
            ->where('shop_id', $shop->id)
            ->whereIn('status', ['pending', 'active'])
            ->where('expires_at', '>', now())
            ->when($excludeCouponId, fn ($query) => $query->where('id', '!=', $excludeCouponId))
            ->selectRaw('COALESCE(SUM(reserved_budget - COALESCE((SELECT SUM(discount_amount) FROM coupon_usages WHERE coupon_usages.coupon_id = coupons.id), 0)), 0) as reserved')
            ->value('reserved');

        return $cashBalance - (int) $reserved;
    }

    private function record(array $attributes): void
    {
        FinancialLog::query()->firstOrCreate(
            [
                'source_type' => $attributes['source_type'],
                'source_id' => $attributes['source_id'],
                'type' => $attributes['type'],
            ],
            $attributes,
        );
    }
}
