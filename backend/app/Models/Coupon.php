<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'code', 'created_by_role', 'created_by_user_id', 'shop_id', 'discount_type', 'discount_value',
    'max_discount_amount', 'min_basket_amount', 'usage_limit', 'used_count', 'reserved_budget',
    'status', 'expires_at', 'reviewed_by', 'reviewed_at',
])]
class Coupon extends Model
{
    protected function casts(): array
    {
        return [
            'discount_value' => 'float',
            'expires_at' => 'immutable_datetime',
            'reviewed_at' => 'immutable_datetime',
        ];
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function usages(): HasMany
    {
        return $this->hasMany(CouponUsage::class);
    }
}
