<?php

namespace App\Services\Payments;

use App\Contracts\PaymentGateway;
use App\Exceptions\PaymentGatewayException;
use App\Models\AppointmentPayment;

class DemoPaymentGateway implements PaymentGateway
{
    public function capture(AppointmentPayment $payment): string
    {
        $this->ensureEnabled();

        if ($payment->status === 'paid' && $payment->provider_payment_id) {
            return $payment->provider_payment_id;
        }

        if ($payment->status !== 'pending') {
            throw new PaymentGatewayException('Only pending demo payments can be captured.');
        }

        return 'demo-payment-'.$payment->id;
    }

    public function refund(AppointmentPayment $payment): string
    {
        $this->ensureEnabled();

        if ($payment->status === 'refunded' && $payment->provider_refund_id) {
            return $payment->provider_refund_id;
        }

        if (! in_array($payment->status, ['refund_pending', 'refund_failed'], true)) {
            throw new PaymentGatewayException('Only captured payments can be refunded.');
        }

        if ($payment->refund_idempotency_key === null) {
            throw new PaymentGatewayException('A stable refund idempotency key is required.');
        }

        return 'demo-refund-'.$payment->refund_idempotency_key;
    }

    private function ensureEnabled(): void
    {
        if (! (bool) config('payments.demo_enabled')) {
            throw new PaymentGatewayException('Demo payments are disabled for this environment.');
        }
    }
}
