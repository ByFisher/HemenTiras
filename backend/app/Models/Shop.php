<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'owner_user_id', 'slug', 'name', 'description', 'status', 'is_approved', 'city', 'district',
    'street', 'phone', 'cover_image_url', 'profile_image_url', 'working_hours', 'commission_rate',
])]
class Shop extends Model
{
    protected function casts(): array
    {
        return ['working_hours' => 'array', 'commission_rate' => 'float', 'is_approved' => 'boolean'];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    public function services(): HasMany
    {
        return $this->hasMany(ShopService::class);
    }

    public function staff(): HasMany
    {
        return $this->hasMany(ShopStaff::class, 'shop_id');
    }

    public function appointments(): HasMany
    {
        return $this->hasMany(Appointment::class);
    }

    public function contentSubmissions(): HasMany
    {
        return $this->hasMany(ShopContentSubmission::class);
    }

    public function financialLogs(): HasMany
    {
        return $this->hasMany(FinancialLog::class);
    }

    public function coupons(): HasMany
    {
        return $this->hasMany(Coupon::class);
    }
}
