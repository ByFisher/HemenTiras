<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CustomerController extends Controller
{
    public function index(Request $request)
    {
        $shop = $request->user()->shops()->firstOrFail();
        $latestAppointments = Appointment::query()
            ->where('shop_id', $shop->id)
            ->selectRaw('customer_id, MAX(starts_at) as last_appointment_at')
            ->groupBy('customer_id');
        $customers = User::query()
            ->joinSub($latestAppointments, 'latest_appointments', fn ($join) => $join->on('users.id', '=', 'latest_appointments.customer_id'))
            ->select('users.*', 'latest_appointments.last_appointment_at')
            ->when($request->string('search')->isNotEmpty(), fn ($query) => $query->where('users.name', 'like', '%'.$request->string('search').'%'))
            ->when($request->string('appointment_status')->isNotEmpty(), function ($query) use ($request, $shop): void {
                $status = $request->string('appointment_status')->value() === 'active'
                    ? ['pending', 'confirmed']
                    : ['completed'];
                $query->whereExists(function ($subquery) use ($status, $shop): void {
                    $subquery->selectRaw('1')
                        ->from('appointments')
                        ->whereColumn('appointments.customer_id', 'users.id')
                        ->where('appointments.shop_id', $shop->id)
                        ->whereIn('appointments.status', $status);
                });
            })
            ->orderByDesc('latest_appointments.last_appointment_at')
            ->get();

        return response()->json($customers->map(function (User $customer) use ($shop): array {
            $latest = Appointment::query()->where('shop_id', $shop->id)->where('customer_id', $customer->id)->latest('starts_at')->first();
            $parts = preg_split('/\s+/u', trim($customer->name), 2) ?: [$customer->name];
            $surname = $parts[1] ?? '';

            return [
                'id' => (string) $customer->id,
                'firstName' => $parts[0],
                'maskedSurname' => $surname === '' ? '' : mb_substr($surname, 0, 1).'***',
                'maskedPhone' => $this->maskPhone($customer->phone),
                'lastAppointmentAt' => $customer->last_appointment_at,
                'appointmentStatus' => in_array($latest?->status, ['pending', 'confirmed'], true) ? 'active' : 'completed',
                'appointmentDate' => $latest?->starts_at->toDateString(),
                'hasContactConsent' => $customer->has_contact_consent,
            ];
        }));
    }

    public function contact(Request $request, User $customer)
    {
        $shop = $request->user()->shops()->firstOrFail();
        $hasAppointmentToday = Appointment::query()
            ->where('shop_id', $shop->id)
            ->where('customer_id', $customer->id)
            ->whereIn('status', ['pending', 'confirmed'])
            ->whereDate('starts_at', now()->toDateString())
            ->exists();
        abort_unless($hasAppointmentToday || $customer->has_contact_consent, 403, 'Tam iletişim bilgisi için bugün aktif randevu veya müşteri onayı gerekir.');

        DB::table('audit_logs')->insert([
            'actor_user_id' => $request->user()->id,
            'action' => 'customer.contact_revealed',
            'subject_type' => User::class,
            'subject_id' => (string) $customer->id,
            'metadata' => json_encode(['shop_id' => $shop->id]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'fullName' => $customer->name,
            'phone' => $customer->phone ?? '',
            'expiresAt' => now()->addMinute()->toISOString(),
        ]);
    }

    private function maskPhone(?string $phone): string
    {
        if (! $phone) {
            return '—';
        }

        $digits = preg_replace('/\D+/', '', $phone) ?? '';

        return mb_substr($digits, 0, 3).' *** ** '.mb_substr($digits, -2);
    }
}
