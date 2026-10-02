<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppointmentPayment;
use App\Services\AppointmentCancellationService;
use App\Services\AppointmentPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminPaymentController extends Controller
{
    public function retryRefund(
        Request $request,
        AppointmentPayment $payment,
        AppointmentCancellationService $cancellation,
        AppointmentPresenter $presenter,
    ): JsonResponse {
        abort_unless(in_array($payment->status, ['refund_pending', 'refund_failed'], true), 409, 'Bu ödeme yeniden iade edilemez.');
        $appointment = $payment->appointment()->firstOrFail();
        abort_unless(in_array($appointment->status, ['cancelled', 'cancelled_by_shop'], true), 409, 'Randevu iptal edilmeden ödeme iadesi yapılamaz.');

        $result = $cancellation->cancel($appointment, $request->user(), $appointment->cancellation_reason);
        if ($result['refundFailed']) {
            return response()->json([
                'message' => 'İade sağlayıcısı isteği tamamlayamadı. Aynı idempotency anahtarıyla yeniden denenebilir.',
                'appointment' => $presenter->present($result['appointment']),
            ], 502);
        }

        return response()->json($presenter->present($result['appointment']));
    }
}
