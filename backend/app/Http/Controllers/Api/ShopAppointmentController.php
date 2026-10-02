<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\Shop;
use App\Services\AppointmentCancellationService;
use App\Services\AppointmentPresenter;
use Illuminate\Http\Request;

class ShopAppointmentController extends Controller
{
    public function index(Request $request, AppointmentPresenter $presenter)
    {
        $shop = $this->shop($request);
        $status = $request->string('status')->value();
        abort_if($status !== '' && ! in_array($status, ['pending', 'confirmed', 'completed', 'cancelled', 'cancelled_by_shop', 'no_show'], true), 422, 'Geçersiz randevu durumu.');

        $appointments = $shop->appointments()
            ->with(['shop', 'staff', 'service', 'review', 'payment'])
            ->when(
                $status !== '',
                fn ($query) => $query->where('status', $status),
                fn ($query) => $query->where(function ($active): void {
                    $active->where(function ($upcoming): void {
                        $upcoming->whereIn('status', ['pending', 'confirmed'])
                            ->where('starts_at', '>=', now());
                    })->orWhere(function ($recent): void {
                        $recent->whereIn('status', ['completed', 'cancelled', 'cancelled_by_shop', 'no_show'])
                            ->where('starts_at', '>=', now()->subDays(7));
                    });
                }),
            )
            ->orderByDesc('starts_at')
            ->limit(100)
            ->get();

        return response()->json($appointments->map(fn (Appointment $appointment) => $presenter->present($appointment)));
    }

    public function cancel(
        Request $request,
        Appointment $appointment,
        AppointmentCancellationService $cancellation,
        AppointmentPresenter $presenter,
    ) {
        abort_unless($appointment->shop_id === $this->shop($request)->id, 404);
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:500']]);
        $result = $cancellation->cancel($appointment, $request->user(), $data['reason'] ?? null);
        $response = $presenter->present($result['appointment']);

        if ($result['refundFailed']) {
            return response()->json([
                'message' => 'Randevu iptal edildi ancak iade sağlayıcısı isteği tamamlayamadı. İade aynı kayıt üzerinden tekrar denenebilir.',
                'appointment' => $response,
            ], 502);
        }

        return response()->json($response);
    }

    private function shop(Request $request): Shop
    {
        return $request->user()->shops()->firstOrFail();
    }
}
