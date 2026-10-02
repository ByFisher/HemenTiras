<?php

namespace App\Contracts;

use App\Models\AppointmentPayment;
use App\Models\User;

interface HostedCheckoutGateway
{
    /**
     * @param  array{identityNumber: string, registrationAddress: string}  $buyerDetails
     * @return array{token: string, checkoutUrl: string}
     */
    public function initializeCheckout(
        AppointmentPayment $payment,
        User $customer,
        array $buyerDetails,
        string $ip,
        string $callbackUrl,
    ): array;

    /**
     * @return array{status: string, paymentId?: string, transactionId?: string, currency?: string, price?: string}
     */
    public function retrieveCheckout(AppointmentPayment $payment, string $token): array;
}
