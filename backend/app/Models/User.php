<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['name', 'email', 'password', 'role', 'status', 'phone', 'city', 'district', 'avatar_url', 'has_contact_consent', 'last_login_at'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'has_contact_consent' => 'boolean',
            'last_login_at' => 'datetime',
        ];
    }

    public function shops(): HasMany
    {
        return $this->hasMany(Shop::class, 'owner_user_id');
    }

    public function appointments(): HasMany
    {
        return $this->hasMany(Appointment::class, 'customer_id');
    }

    public function favoriteShops(): BelongsToMany
    {
        return $this->belongsToMany(Shop::class, 'shop_favorites')->withTimestamps();
    }

    public function financialLogs(): HasMany
    {
        return $this->hasMany(FinancialLog::class);
    }

    public function coupons(): HasMany
    {
        return $this->hasMany(Coupon::class, 'created_by_user_id');
    }
}
