<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'appointment_id', 'provider', 'payment_intent_id', 'checkout_url', 'provider_payment_id', 'provider_refund_id',
    'transaction_id', 'payment_method', 'amount', 'currency', 'status', 'payment_status', 'user_id', 'shop_id',
    'discount_amount', 'coupon_id', 'refund_idempotency_key', 'paid_at',
    'refunded_at', 'failure_code',
])]
class AppointmentPayment extends Model
{
    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'discount_amount' => 'integer',
            'paid_at' => 'datetime',
            'refunded_at' => 'datetime',
        ];
    }

    public function appointment(): BelongsTo
    {
        return $this->belongsTo(Appointment::class);
    }

    protected function setStatusAttribute(string $status): void
    {
        $this->attributes['status'] = $status;
        $this->attributes['payment_status'] = $status;
    }
}
