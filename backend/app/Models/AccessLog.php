<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'user_id',
    'anonymous_visitor_id',
    'ip_address',
    'client_port',
    'occurred_at_utc',
    'occurred_at_local',
    'user_agent',
    'device_type',
    'http_method',
    'request_path',
    'response_status',
    'privacy_notice_version',
    'notice_acknowledged_at',
    'explicit_consent_purpose',
    'explicit_consent_version',
    'explicit_consent_granted',
    'explicit_consent_at',
])]
class AccessLog extends Model
{
    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'occurred_at_utc' => 'immutable_datetime',
            'notice_acknowledged_at' => 'immutable_datetime',
            'explicit_consent_granted' => 'boolean',
            'explicit_consent_at' => 'immutable_datetime',
        ];
    }
}
