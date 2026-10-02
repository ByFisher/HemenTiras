<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PrivacyConsent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PrivacyConsentController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'privacy_notice_version' => [
                'required',
                'string',
                'max:64',
                Rule::in(array_filter([config('privacy.notice_version')])),
            ],
            'notice_acknowledged' => ['required', 'accepted'],
            'explicit_consent' => ['sometimes', 'array'],
            'explicit_consent.purpose' => [
                'required_with:explicit_consent',
                'string',
                'max:100',
                Rule::in(array_keys(config('privacy.explicit_consent_versions', []))),
            ],
            'explicit_consent.version' => ['required_with:explicit_consent', 'string', 'max:64'],
            'explicit_consent.granted' => ['required_with:explicit_consent', 'boolean'],
        ]);
        $user = $request->user();
        $visitorId = $request->cookie('ht_visitor_id');
        if (! $user && (! is_string($visitorId) || ! Str::isUuid($visitorId))) {
            throw ValidationException::withMessages([
                'visitor' => ['Ziyaretçi kimliği bulunamadı; isteği yeniden deneyin.'],
            ]);
        }
        $explicitConsent = $data['explicit_consent'] ?? null;
        if (
            $explicitConsent
            && config('privacy.explicit_consent_versions.'.$explicitConsent['purpose']) !== $explicitConsent['version']
        ) {
            throw ValidationException::withMessages([
                'explicit_consent.version' => ['Açık rıza sürümü yayımlanmış sürümle eşleşmiyor.'],
            ]);
        }

        $consent = PrivacyConsent::query()->create([
            'user_id' => $user?->id,
            'anonymous_visitor_id' => $user ? null : $visitorId,
            'privacy_notice_version' => $data['privacy_notice_version'],
            'notice_acknowledged_at' => now(),
            'explicit_consent_purpose' => $explicitConsent['purpose'] ?? null,
            'explicit_consent_version' => $explicitConsent['version'] ?? null,
            'explicit_consent_granted' => $explicitConsent['granted'] ?? null,
            'explicit_consent_at' => $explicitConsent ? now() : null,
        ]);

        return response()->json(['id' => (string) $consent->id], 201);
    }
}
