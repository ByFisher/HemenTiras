<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccessLog;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AccessLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $this->filters($request);
        $logs = $this->query($filters)
            ->orderByDesc('occurred_at_utc')
            ->paginate(min(max($request->integer('per_page', 50), 1), 100));

        return response()->json([
            'data' => $logs->getCollection()->map(fn (AccessLog $log) => $this->present($log)),
            'meta' => [
                'currentPage' => $logs->currentPage(),
                'lastPage' => $logs->lastPage(),
                'perPage' => $logs->perPage(),
                'total' => $logs->total(),
            ],
        ]);
    }

    public function export(Request $request): StreamedResponse
    {
        $filters = $this->filters($request);
        $rows = $this->query($filters)->orderByDesc('occurred_at_utc')->limit(10_000);
        $timestamp = now('UTC')->format('Ymd-His');

        return response()->streamDownload(function () use ($rows): void {
            $output = fopen('php://output', 'w');
            if ($output === false) {
                throw new \RuntimeException('Could not open the CSV output stream.');
            }
            fwrite($output, "\xEF\xBB\xBF");
            fputcsv($output, [
                'id', 'occurred_at_utc', 'occurred_at_local', 'ip_address', 'client_port',
                'user_id', 'anonymous_visitor_id', 'device_type', 'user_agent',
                'http_method', 'request_path', 'response_status', 'privacy_notice_version',
                'notice_acknowledged_at', 'explicit_consent_purpose',
                'explicit_consent_version', 'explicit_consent_granted', 'explicit_consent_at',
            ]);
            foreach ($rows->lazy(500)->take(10_000) as $log) {
                fputcsv($output, array_map(
                    fn (mixed $value) => $this->csvSafe($value),
                    array_values($this->present($log)),
                ));
            }
            fclose($output);
        }, "access-logs-{$timestamp}.csv", ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /**
     * @return array{ip?: string, from?: string, to?: string, user_id?: string, device_type?: string, method?: string}
     */
    private function filters(Request $request): array
    {
        return $request->validate([
            'ip' => ['nullable', 'ip'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', Rule::when($request->filled('from'), ['after_or_equal:from'])],
            'user_id' => ['nullable', 'integer', 'min:1'],
            'device_type' => ['nullable', 'in:desktop,mobile,tablet,bot,unknown'],
            'method' => ['nullable', 'in:GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD'],
        ]);
    }

    /**
     * @param  array<string, string>  $filters
     * @return Builder<AccessLog>
     */
    private function query(array $filters): Builder
    {
        return AccessLog::query()
            ->when(isset($filters['ip']), fn (Builder $query) => $query->where('ip_address', $filters['ip']))
            ->when(isset($filters['from']), fn (Builder $query) => $query->where('occurred_at_utc', '>=', $filters['from'].' 00:00:00'))
            ->when(isset($filters['to']), fn (Builder $query) => $query->where('occurred_at_utc', '<=', $filters['to'].' 23:59:59'))
            ->when(isset($filters['user_id']), fn (Builder $query) => $query->where('user_id', $filters['user_id']))
            ->when(isset($filters['device_type']), fn (Builder $query) => $query->where('device_type', $filters['device_type']))
            ->when(isset($filters['method']), fn (Builder $query) => $query->where('http_method', $filters['method']));
    }

    private function present(AccessLog $log): array
    {
        return [
            'id' => (string) $log->id,
            'occurredAtUtc' => $log->occurred_at_utc?->toISOString(),
            'occurredAtLocal' => $log->occurred_at_local,
            'ipAddress' => $log->ip_address,
            'clientPort' => $log->client_port,
            'userId' => $log->user_id === null ? null : (string) $log->user_id,
            'anonymousVisitorId' => $log->anonymous_visitor_id,
            'deviceType' => $log->device_type,
            'userAgent' => $log->user_agent,
            'method' => $log->http_method,
            'path' => $log->request_path,
            'status' => $log->response_status,
            'privacyNoticeVersion' => $log->privacy_notice_version,
            'noticeAcknowledgedAt' => $log->notice_acknowledged_at?->toISOString(),
            'explicitConsentPurpose' => $log->explicit_consent_purpose,
            'explicitConsentVersion' => $log->explicit_consent_version,
            'explicitConsentGranted' => $log->explicit_consent_granted,
            'explicitConsentAt' => $log->explicit_consent_at?->toISOString(),
        ];
    }

    private function csvSafe(mixed $value): string
    {
        $value = (string) ($value ?? '');

        return preg_match('/^[\s]*[=+\-@]/u', $value) ? "'".$value : $value;
    }
}
