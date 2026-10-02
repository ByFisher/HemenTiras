<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'shop_id', 'first_name', 'last_name', 'title', 'experience_years', 'biography',
    'approval_status', 'working_hours', 'skills', 'work_logs',
])]
class ShopStaff extends Model
{
    protected $table = 'staff';

    protected function casts(): array
    {
        return [
            'working_hours' => 'array',
            'skills' => 'array',
            'work_logs' => 'array',
        ];
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class);
    }

    public function appointments(): HasMany
    {
        return $this->hasMany(Appointment::class, 'staff_id');
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(StaffReview::class, 'staff_id')->where('moderation_status', 'approved');
    }
}
