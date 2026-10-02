<?php

namespace App\Services;

use App\Contracts\PaymentGateway;
use App\Exceptions\PaymentGatewayException;
use App\Models\Appointment;
use App\Models\AppointmentPayment;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AppointmentCancellationService
{
    public function __construct(
        private readonly PaymentGateway $gateway,
        private readonly FinancialLedger $ledger,
    ) {}

    /**
     * @return array{appointment: Appointment, refundFailed: bool}
     */
    public function cancel(Appointment $appointment, User $actor, ?string $reason): array
    {
        $appointment = DB::transaction(function () use ($appointment, $actor, $reason): Appointment {
            $locked = Appointment::query()->whereKey($appointment->id)->lockForUpdate()->firstOrFail();
            $wasActive = in_array($locked->status, ['pending', 'confirmed'], true);
            $cancelledStatuses = ['cancelled', 'cancelled_by_shop'];
            abort_unless($wasActive || in_array($locked->status, $cancelledStatuses, true), 409, 'Bu randevu iptal edilemez.');

            if ($wasActive) {
                $locked->update([
                    'status' => $actor->role === 'shop_owner' ? 'cancelled_by_shop' : 'cancelled',
                    'cancellation_reason' => $reason,
                    'cancelled_by_user_id' => $actor->id,
                    'cancelled_at' => now(),
                ]);
                DB::table('audit_logs')->insert([
                    'actor_user_id' => $actor->id,
                    'action' => 'appointment.cancelled',
                    'subject_type' => Appointment::class,
                    'subject_id' => (string) $locked->id,
                    'metadata' => json_encode([
                        'shop_id' => $locked->shop_id,
                        'reason' => $reason,
                    ], JSON_THROW_ON_ERROR),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            $payment = $locked->payment()->lockForUpdate()->first();
            if ($payment?->status === 'paid') {
                $payment->update([
                    'status' => 'refund_pending',
                    'refund_idempotency_key' => (string) Str::uuid(),
                    'failure_code' => null,
                ]);
            } elseif ($payment?->status === 'refund_failed') {
                $payment->update(['status' => 'refund_pending', 'failure_code' => null]);
            }

            return $locked->refresh()->load(['shop', 'staff', 'service', 'review', 'payment']);
        });

        $payment = $appointment->payment;
        if ($payment?->status === 'refund_pending') {
            try {
                $refundId = $this->gateway->refund($payment);
                DB::transaction(function () use ($payment, $refundId, $actor, $appointment): void {
                    $updated = AppointmentPayment::query()
                        ->whereKey($payment->id)
                        ->whereIn('status', ['refund_pending', 'refund_failed'])
                        ->update([
                            'status' => 'refunded',
                            'payment_status' => 'refunded',
                            'provider_refund_id' => $refundId,
                            'refunded_at' => now(),
                            'failure_code' => null,
                            'updated_at' => now(),
                        ]);
                    if ($updated > 0) {
                        $this->ledger->recordRefund($payment->refresh(), $actor);
                        DB::table('audit_logs')->insert([
                            'actor_user_id' => $actor->id,
                            'action' => 'appointment.refunded',
                            'subject_type' => Appointment::class,
                            'subject_id' => (string) $appointment->id,
                            'metadata' => json_encode([
                                'payment_id' => $payment->id,
                                'amount' => $payment->amount,
                                'currency' => $payment->currency,
                                'provider' => $payment->provider,
                            ], JSON_THROW_ON_ERROR),
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                    }
                });
            } catch (PaymentGatewayException) {
                AppointmentPayment::query()
                    ->whereKey($payment->id)
                    ->where('status', 'refund_pending')
                    ->update([
                        'status' => 'refund_failed',
                        'payment_status' => 'refund_failed',
                        'failure_code' => 'gateway_error',
                        'updated_at' => now(),
                    ]);
                $payment->refresh();
                if ($payment->status !== 'refunded') {
                    DB::table('audit_logs')->insert([
                        'actor_user_id' => $actor->id,
                        'action' => 'appointment.refund_failed',
                        'subject_type' => Appointment::class,
                        'subject_id' => (string) $appointment->id,
                        'metadata' => json_encode(['payment_id' => $payment->id], JSON_THROW_ON_ERROR),
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }

                return [
                    'appointment' => $appointment->refresh()->load('payment'),
                    'refundFailed' => $payment->status !== 'refunded',
                ];
            }

            $appointment->setRelation('payment', $payment->refresh());
        }

        return [
            'appointment' => $appointment->refresh()->load(['shop', 'staff', 'service', 'review', 'payment']),
            'refundFailed' => false,
        ];
    }
}
