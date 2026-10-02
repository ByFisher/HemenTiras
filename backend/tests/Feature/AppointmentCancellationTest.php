<?php

namespace Tests\Feature;

use App\Contracts\PaymentGateway;
use App\Exceptions\PaymentGatewayException;
use App\Models\Appointment;
use App\Models\Shop;
use App\Models\ShopService;
use App\Models\ShopStaff;
use App\Models\User;
use App\Services\Payments\DemoPaymentGateway;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AppointmentCancellationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['payments.driver' => 'demo', 'payments.demo_enabled' => true]);
    }

    public function test_shop_owner_cancellation_fully_refunds_a_captured_demo_payment(): void
    {
        [$owner, $customer, $appointment] = $this->appointment();
        $this->actingAs($customer)->postJson("/api/v1/appointments/{$appointment->id}/demo-pay")
            ->assertOk()
            ->assertJsonPath('payment.status', 'paid');
        $this->assertDatabaseHas('appointment_payments', [
            'appointment_id' => $appointment->id,
            'payment_method' => 'demo',
            'transaction_id' => 'demo-payment-'.$appointment->payment()->value('id'),
        ]);

        $response = $this->actingAs($owner)->postJson("/api/v1/shop/appointments/{$appointment->id}/cancel", [
            'reason' => 'Personel hastalığı',
        ])->assertOk()
            ->assertJsonPath('status', 'cancelled_by_shop')
            ->assertJsonPath('cancellationReason', 'Personel hastalığı')
            ->assertJsonPath('payment.status', 'refunded')
            ->assertJsonPath('payment.refundAmount', 750);

        $payment = $appointment->payment()->firstOrFail();
        $this->assertSame(750, $payment->amount);
        $this->assertSame('refunded', $payment->payment_status);
        $this->assertNotNull($payment->provider_refund_id);
        $this->assertDatabaseHas('appointments', [
            'id' => $appointment->id,
            'cancelled_by_user_id' => $owner->id,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'appointment.cancelled',
            'subject_id' => (string) $appointment->id,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'appointment.payment_captured',
            'subject_id' => (string) $appointment->id,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'appointment.refunded',
            'subject_id' => (string) $appointment->id,
        ]);
        $this->assertDatabaseHas('financial_logs', [
            'shop_id' => $appointment->shop_id,
            'type' => 'payment',
            'amount' => 750,
        ]);
        $this->assertDatabaseHas('financial_logs', [
            'shop_id' => $appointment->shop_id,
            'type' => 'refund',
            'amount' => -750,
        ]);
        $this->actingAs($customer)->getJson('/api/v1/appointments?status=upcoming')
            ->assertOk()
            ->assertJsonPath('0.status', 'cancelled_by_shop')
            ->assertJsonPath('0.payment.status', 'refunded');

        $this->actingAs($owner)->postJson("/api/v1/shop/appointments/{$appointment->id}/cancel")
            ->assertOk()
            ->assertJsonPath('payment.status', 'refunded');
        $this->assertDatabaseCount('appointment_payments', 1);
        $this->assertDatabaseCount('audit_logs', 3);
    }

    public function test_shop_owner_can_cancel_unpaid_appointments_without_creating_a_refund(): void
    {
        [$owner, , $appointment] = $this->appointment();

        $this->actingAs($owner)->getJson('/api/v1/shop/appointments')
            ->assertOk()
            ->assertJsonPath('0.id', (string) $appointment->id)
            ->assertJsonPath('0.payment.status', 'unpaid');

        $this->postJson("/api/v1/shop/appointments/{$appointment->id}/cancel")
            ->assertOk()
            ->assertJsonPath('status', 'cancelled_by_shop')
            ->assertJsonPath('payment.status', 'unpaid')
            ->assertJsonPath('payment.refundAmount', 0);

        $this->assertDatabaseCount('appointment_payments', 0);
    }

    public function test_shop_owner_cannot_cancel_another_shops_appointment(): void
    {
        [$owner, , $appointment] = $this->appointment();
        $otherOwner = $this->user('shop_owner');
        $this->shop($otherOwner, 'other-owner-shop');

        $this->getJson('/api/v1/shop/appointments')->assertUnauthorized();
        $this->actingAs($this->user('customer'))->getJson('/api/v1/shop/appointments')->assertForbidden();
        $this->actingAs($otherOwner)->postJson("/api/v1/shop/appointments/{$appointment->id}/cancel")
            ->assertNotFound();
        $this->assertDatabaseHas('appointments', ['id' => $appointment->id, 'status' => 'confirmed']);
    }

    public function test_failed_refund_is_reported_and_can_be_retried_with_the_same_idempotency_key(): void
    {
        [$owner, $customer, $appointment] = $this->appointment();
        $this->actingAs($customer)->postJson("/api/v1/appointments/{$appointment->id}/demo-pay")->assertOk();

        $gateway = $this->mock(PaymentGateway::class);
        $gateway->shouldReceive('refund')->once()->andThrow(new PaymentGatewayException('Provider unavailable'));
        $this->actingAs($owner)->postJson("/api/v1/shop/appointments/{$appointment->id}/cancel")
            ->assertStatus(502)
            ->assertJsonPath('appointment.payment.status', 'refund_failed');

        $payment = $appointment->payment()->firstOrFail();
        $idempotencyKey = $payment->refund_idempotency_key;
        $this->app->instance(PaymentGateway::class, new DemoPaymentGateway);

        $this->postJson("/api/v1/shop/appointments/{$appointment->id}/cancel")
            ->assertOk()
            ->assertJsonPath('payment.status', 'refunded');
        $this->assertSame($idempotencyKey, $payment->refresh()->refund_idempotency_key);
    }

    public function test_demo_payment_can_only_be_started_for_the_own_customers_appointment_in_demo_mode(): void
    {
        [$owner, $customer, $appointment] = $this->appointment();
        $otherCustomer = $this->user('customer');
        $this->actingAs($otherCustomer)->postJson("/api/v1/appointments/{$appointment->id}/demo-pay")->assertNotFound();

        config(['payments.demo_enabled' => false]);
        $this->actingAs($customer)->postJson("/api/v1/appointments/{$appointment->id}/demo-pay")->assertNotFound();
        $this->actingAs($owner)->postJson("/api/v1/appointments/{$appointment->id}/demo-pay")->assertForbidden();
    }

    public function test_repair_migration_recreates_the_payments_table_if_it_is_missing(): void
    {
        Schema::drop('appointment_payments');
        $migration = require database_path('migrations/2026_10_02_120000_repair_appointment_payments_table.php');
        $migration->up();

        $this->assertTrue(Schema::hasTable('appointment_payments'));
        $this->assertTrue(Schema::hasColumns('appointment_payments', [
            'appointment_id',
            'payment_intent_id',
            'checkout_url',
            'transaction_id',
            'payment_method',
            'amount',
            'status',
            'created_at',
            'updated_at',
        ]));
    }

    /**
     * @return array{User, User, Appointment}
     */
    private function appointment(): array
    {
        $owner = $this->user('shop_owner');
        $customer = $this->user('customer');
        $shop = $this->shop($owner);
        $staff = ShopStaff::query()->create([
            'shop_id' => $shop->id,
            'first_name' => 'Ali',
            'last_name' => 'Usta',
            'title' => 'Berber',
            'approval_status' => 'approved',
        ]);
        $service = ShopService::query()->create([
            'shop_id' => $shop->id,
            'name' => 'Saç kesimi',
            'duration_minutes' => 30,
            'price' => 750,
        ]);
        $appointment = Appointment::query()->create([
            'customer_id' => $customer->id,
            'shop_id' => $shop->id,
            'staff_id' => $staff->id,
            'service_id' => $service->id,
            'starts_at' => now()->addDay(),
            'ends_at' => now()->addDay()->addMinutes(30),
            'status' => 'confirmed',
            'total_price' => 750,
        ]);

        return [$owner, $customer, $appointment];
    }

    private function user(string $role): User
    {
        return User::query()->create([
            'name' => ucfirst($role).' User',
            'email' => $role.'-'.uniqid().'@example.test',
            'password' => Hash::make('long-test-password'),
            'role' => $role,
            'status' => 'active',
        ]);
    }

    private function shop(User $owner, string $slug = 'cancellation-shop'): Shop
    {
        return Shop::query()->create([
            'owner_user_id' => $owner->id,
            'slug' => $slug,
            'name' => 'Cancellation Shop',
            'status' => 'active',
            'is_approved' => true,
            'city' => 'İstanbul',
            'district' => 'Kadıköy',
        ]);
    }
}
