<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'user_id',
    'anonymous_visitor_id',
    'privacy_notice_version',
    'notice_acknowledged_at',
    'explicit_consent_purpose',
    'explicit_consent_version',
    'explicit_consent_granted',
    'explicit_consent_at',
])]
class PrivacyConsent extends Model
{
    protected function casts(): array
    {
        return [
            'notice_acknowledged_at' => 'immutable_datetime',
            'explicit_consent_granted' => 'boolean',
            'explicit_consent_at' => 'immutable_datetime',
        ];
    }
}
