<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'shop_id', 'submitted_by', 'related_entity_id', 'kind', 'title', 'description',
    'payload', 'preview_url', 'file_path', 'approval_status', 'rejection_reason', 'reviewed_by', 'reviewed_at',
])]
class ShopContentSubmission extends Model
{
    protected function casts(): array
    {
        return ['reviewed_at' => 'datetime', 'payload' => 'array'];
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class);
    }
}
