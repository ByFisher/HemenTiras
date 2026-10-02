<?php

namespace App\Http\Controllers\Api;

use App\Contracts\HostedCheckoutGateway;
use App\Contracts\PaymentGateway;
use App\Exceptions\PaymentGatewayException;
use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\AppointmentPayment;
use App\Services\AppointmentCancellationService;
use App\Services\AppointmentPresenter;
use App\Services\FinancialLedger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AppointmentPaymentController extends Controller
{
    public function startCheckout(Request $request, Appointment $appointment, PaymentGateway $gateway)
    {
        abort_unless(config('payments.driver') === 'iyzico' && $gateway instanceof HostedCheckoutGateway, 404);
        abort_unless($appointment->customer_id === $request->user()->id, 404);

        $data = $request->validate([
            'identityNumber' => ['required', 'digits:11'],
            'registrationAddress' => ['required', 'string', 'min:5', 'max:500'],
        ]);
        abort_if(! $request->user()->phone || ! $request->user()->city, 422, 'iyzico ödemesi için profilinizde telefon ve şehir bilgisi bulunmalıdır.');

        $payment = DB::transaction(function () use ($appointment): AppointmentPayment {
            $lockedAppointment = Appointment::query()->whereKey($appointment->id)->lockForUpdate()->firstOrFail();
            abort_unless(in_array($lockedAppointment->status, ['pending', 'confirmed'], true), 409, 'Bu randevu için ödeme başlatılamaz.');
            $payment = $lockedAppointment->payment()->lockForUpdate()->first();

            if ($payment?->status === 'paid') {
                abort(409, 'Bu randevunun ödemesi zaten alınmış.');
            }
            abort_if($payment && in_array($payment->status, ['refund_pending', 'refunded', 'refund_failed'], true), 409, 'İade sürecindeki ödeme yeniden başlatılamaz.');
            abort_if($payment && $payment->provider !== 'iyzico', 409, 'Bu randevudaki ödeme başka bir sağlayıcıyla başlatılmış.');

            if ($payment?->status === 'pending' && $payment->payment_intent_id && $payment->checkout_url) {
                return $payment;
            }

            if (! $payment) {
                return $lockedAppointment->payment()->create([
                    'provider' => 'iyzico',
                    'payment_method' => 'iyzico_checkout_form',
                    'amount' => $lockedAppointment->total_price,
                    'currency' => 'TRY',
                    'status' => 'pending',
                    'payment_status' => 'pending',
                    'user_id' => $lockedAppointment->customer_id,
                    'shop_id' => $lockedAppointment->shop_id,
                    'discount_amount' => $lockedAppointment->discount_amount,
                    'coupon_id' => $lockedAppointment->coupon_id,
                ]);
            }

            $payment->update([
                'payment_method' => 'iyzico_checkout_form',
                'amount' => $lockedAppointment->total_price,
                'currency' => 'TRY',
                'status' => 'pending',
                'payment_status' => 'pending',
                'user_id' => $lockedAppointment->customer_id,
                'shop_id' => $lockedAppointment->shop_id,
                'discount_amount' => $lockedAppointment->discount_amount,
                'coupon_id' => $lockedAppointment->coupon_id,
                'payment_intent_id' => null,
                'checkout_url' => null,
                'provider_payment_id' => null,
                'transaction_id' => null,
                'failure_code' => null,
            ]);

            return $payment->refresh();
        });

        if ($payment->payment_intent_id && $payment->checkout_url) {
            return response()->json(['checkoutUrl' => $payment->checkout_url]);
        }

        try {
            $checkout = $gateway->initializeCheckout(
                $payment,
                $request->user(),
                $data,
                (string) $request->ip(),
                config('payments.iyzico.callback_url') ?: route('api.v1.payments.iyzico.callback'),
            );
            $payment->update([
                'payment_intent_id' => $checkout['token'],
                'checkout_url' => $checkout['checkoutUrl'],
                'failure_code' => null,
            ]);
        } catch (PaymentGatewayException) {
            AppointmentPayment::query()
                ->whereKey($payment->id)
                ->where('status', 'pending')
                ->update(['status' => 'failed', 'payment_status' => 'failed', 'failure_code' => 'checkout_initialization_failed', 'updated_at' => now()]);
            Log::warning('iyzico checkout initialization failed.', ['payment_id' => $payment->id]);

            return response()->json(['message' => 'iyzico ödeme formu başlatılamadı. Bilgilerinizi kontrol edip tekrar deneyin.'], 502);
        }

        return response()->json(['checkoutUrl' => $checkout['checkoutUrl']]);
    }

    public function iyzicoCallback(
        Request $request,
        PaymentGateway $gateway,
        AppointmentCancellationService $cancellation,
        FinancialLedger $ledger,
    ) {
        abort_unless(config('payments.driver') === 'iyzico' && $gateway instanceof HostedCheckoutGateway, 404);
        $data = $request->validate(['token' => ['required', 'string', 'max:255']]);
        $payment = AppointmentPayment::query()
            ->where('provider', 'iyzico')
            ->where('payment_intent_id', $data['token'])
            ->firstOrFail();

        if ($payment->status === 'refunded') {
            return $this->returnToCustomer('refunded');
        }
        if (in_array($payment->status, ['paid', 'refund_pending', 'refund_failed'], true)) {
            return $this->returnToCustomer($this->refundIfAppointmentWasCancelled($payment, $cancellation) ?? 'success');
        }
        if ($payment->status !== 'pending') {
            return $this->returnToCustomer('failed');
        }

        try {
            $result = $gateway->retrieveCheckout($payment, $data['token']);
        } catch (PaymentGatewayException) {
            Log::warning('iyzico checkout verification is pending.', ['payment_id' => $payment->id]);

            return $this->returnToCustomer('verification-pending');
        }

        if ($result['status'] !== 'success') {
            $this->markCheckoutFailed($payment);

            return $this->returnToCustomer('failed');
        }

        $this->recordSuccessfulPayment($payment, $result, $ledger);

        return $this->returnToCustomer($this->refundIfAppointmentWasCancelled($payment, $cancellation) ?? 'success');
    }

    public function verifyCustomerCheckout(
        Request $request,
        Appointment $appointment,
        PaymentGateway $gateway,
        AppointmentCancellationService $cancellation,
        AppointmentPresenter $presenter,
        FinancialLedger $ledger,
    ) {
        abort_unless(config('payments.driver') === 'iyzico' && $gateway instanceof HostedCheckoutGateway, 404);
        abort_unless($appointment->customer_id === $request->user()->id, 404);
        $payment = $appointment->payment()->firstOrFail();
        abort_unless($payment->provider === 'iyzico', 404);

        if ($payment->status === 'pending') {
            if (! $payment->payment_intent_id) {
                abort(409, 'Bu ödeme için iyzico doğrulama kaydı bulunamadı.');
            }

            try {
                $result = $gateway->retrieveCheckout($payment, $payment->payment_intent_id);
            } catch (PaymentGatewayException) {
                return response()->json(['message' => 'iyzico ödeme sonucu henüz doğrulanamadı. Biraz sonra tekrar deneyin.'], 502);
            }

            if ($result['status'] === 'success') {
                $this->recordSuccessfulPayment($payment, $result, $ledger);
            } else {
                $this->markCheckoutFailed($payment);
            }
        }

        $payment->refresh();
        if (in_array($payment->status, ['paid', 'refund_pending', 'refund_failed'], true)) {
            $this->refundIfAppointmentWasCancelled($payment, $cancellation);
        }

        return response()->json($presenter->present(
            $appointment->refresh()->load(['shop', 'staff', 'service', 'review', 'payment']),
        ));
    }

    private function refundIfAppointmentWasCancelled(
        AppointmentPayment $payment,
        AppointmentCancellationService $cancellation,
    ): ?string {
        $appointment = $payment->appointment()->with('cancelledBy')->firstOrFail();
        if (! in_array($appointment->status, ['cancelled', 'cancelled_by_shop'], true)) {
            return null;
        }

        $actor = $appointment->cancelledBy;
        if (! $actor) {
            AppointmentPayment::query()->whereKey($payment->id)->update([
                'status' => 'refund_failed',
                'payment_status' => 'refund_failed',
                'failure_code' => 'missing_cancellation_actor',
                'updated_at' => now(),
            ]);
            Log::error('iyzico payment for a cancelled appointment has no cancellation actor.', ['payment_id' => $payment->id]);

            return 'refund-failed';
        }

        $result = $cancellation->cancel($appointment, $actor, $appointment->cancellation_reason);

        return $result['refundFailed'] ? 'refund-failed' : 'refunded';
    }

    /**
     * @param  array{status: string, paymentId: string, transactionId: string, currency: string, price: string}  $result
     */
    private function recordSuccessfulPayment(AppointmentPayment $payment, array $result, FinancialLedger $ledger): void
    {
        DB::transaction(function () use ($payment, $result, $ledger): void {
            $locked = AppointmentPayment::query()->whereKey($payment->id)->lockForUpdate()->firstOrFail();
            if ($locked->status === 'paid') {
                return;
            }
            abort_unless($locked->status === 'pending', 409, 'Bu ödeme artık tamamlanamaz.');
            $locked->update([
                'status' => 'paid',
                'payment_status' => 'paid',
                'provider_payment_id' => $result['paymentId'],
                'transaction_id' => $result['transactionId'],
                'currency' => $result['currency'],
                'paid_at' => now(),
                'failure_code' => null,
            ]);
            $ledger->recordPayment($locked->refresh());
            DB::table('audit_logs')->insert([
                'actor_user_id' => $locked->appointment->customer_id,
                'action' => 'appointment.payment_captured',
                'subject_type' => Appointment::class,
                'subject_id' => (string) $locked->appointment_id,
                'metadata' => json_encode([
                    'payment_id' => $locked->id,
                    'amount' => $locked->amount,
                    'currency' => $locked->currency,
                    'provider' => $locked->provider,
                ], JSON_THROW_ON_ERROR),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });
    }

    private function markCheckoutFailed(AppointmentPayment $payment): void
    {
        AppointmentPayment::query()
            ->whereKey($payment->id)
            ->where('status', 'pending')
            ->update(['status' => 'failed', 'payment_status' => 'failed', 'failure_code' => 'checkout_payment_failed', 'updated_at' => now()]);
    }

    private function returnToCustomer(string $status)
    {
        $url = rtrim((string) config('payments.frontend_url'), '/').'/my-appointments';

        return redirect()->away($url.'?'.http_build_query(['payment' => $status]));
    }
}
