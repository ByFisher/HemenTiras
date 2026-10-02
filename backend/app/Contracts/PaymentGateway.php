<?php

namespace App\Contracts;

use App\Models\AppointmentPayment;

interface PaymentGateway
{
    public function capture(AppointmentPayment $payment): string;

    public function refund(AppointmentPayment $payment): string;
}
