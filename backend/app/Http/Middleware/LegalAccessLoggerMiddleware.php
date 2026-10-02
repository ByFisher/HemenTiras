<?php

namespace App\Http\Middleware;

use App\Models\AccessLog;
use App\Models\PrivacyConsent;
use Closure;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Cookie;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

class LegalAccessLoggerMiddleware
{
    private const VISITOR_COOKIE = 'ht_visitor_id';

    public function handle(Request $request, Closure $next): Response
    {
        $visitorId = $this->visitorId($request);

        try {
            $response = $next($request);
        } catch (Throwable $exception) {
            $this->record($request, $visitorId, $this->statusFor($request, $exception));
            throw $exception;
        }

        $this->record($request, $visitorId, $response->getStatusCode());
        $existingVisitorId = $request->cookie(self::VISITOR_COOKIE);
        if (! is_string($existingVisitorId) || ! Str::isUuid($existingVisitorId)) {
            $response->headers->setCookie(Cookie::create(
                self::VISITOR_COOKIE,
                $visitorId,
                now()->addYear(),
                '/',
                null,
                $request->isSecure(),
                true,
                false,
                'lax',
            ));
        }

        return $response;
    }

    private function statusFor(Request $request, Throwable $exception): int
    {
        return match (true) {
            $exception instanceof HttpExceptionInterface => $exception->getStatusCode(),
            $exception instanceof HttpResponseException => $exception->getResponse()->getStatusCode(),
            $exception instanceof ValidationException => $exception->status,
            $exception instanceof AuthenticationException => $request->expectsJson() ? 401 : 302,
            $exception instanceof AuthorizationException => 403,
            $exception instanceof ModelNotFoundException => 404,
            default => 500,
        };
    }

    private function visitorId(Request $request): string
    {
        $provided = $request->cookie(self::VISITOR_COOKIE);

        return is_string($provided) && Str::isUuid($provided) ? $provided : (string) Str::uuid();
    }

    private function record(Request $request, string $visitorId, int $status): void
    {
        try {
            $user = $request->user();
            $consent = PrivacyConsent::query()
                ->where(function ($query) use ($user, $visitorId): void {
                    if ($user) {
                        $query->where('user_id', $user->id)
                            ->orWhere('anonymous_visitor_id', $visitorId);
                    } else {
                        $query->where('anonymous_visitor_id', $visitorId);
                    }
                })
                ->latest('id')
                ->first();
            $utcNow = now('UTC');
            $localNow = $utcNow->copy()->setTimezone((string) config('app.timezone', 'UTC'));
            $agent = mb_substr((string) $request->userAgent(), 0, 2048);

            AccessLog::query()->create([
                'user_id' => $user?->id,
                'anonymous_visitor_id' => $user ? null : $visitorId,
                'ip_address' => $request->ip(),
                'client_port' => null,
                'occurred_at_utc' => $utcNow,
                'occurred_at_local' => $localNow->toIso8601String(),
                'user_agent' => $agent !== '' ? $agent : null,
                'device_type' => $this->deviceType($agent),
                'http_method' => $request->method(),
                'request_path' => '/'.ltrim($request->path(), '/'),
                'response_status' => $status,
                'privacy_notice_version' => $consent?->privacy_notice_version,
                'notice_acknowledged_at' => $consent?->notice_acknowledged_at,
                'explicit_consent_purpose' => $consent?->explicit_consent_purpose,
                'explicit_consent_version' => $consent?->explicit_consent_version,
                'explicit_consent_granted' => $consent?->explicit_consent_granted,
                'explicit_consent_at' => $consent?->explicit_consent_at,
            ]);
        } catch (Throwable $exception) {
            Log::error('Legal access log could not be persisted.', [
                'exception' => $exception::class,
                'request_path' => '/'.ltrim($request->path(), '/'),
            ]);
        }
    }

    private function deviceType(string $userAgent): string
    {
        if (preg_match('/bot|crawler|spider|slurp/i', $userAgent)) {
            return 'bot';
        }
        if (preg_match('/ipad|tablet|playbook|silk/i', $userAgent)) {
            return 'tablet';
        }
        if (preg_match('/mobile|iphone|ipod|android/i', $userAgent)) {
            return 'mobile';
        }

        return $userAgent === '' ? 'unknown' : 'desktop';
    }
}
