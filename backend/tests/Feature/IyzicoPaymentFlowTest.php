<?php

namespace Tests\Feature;

use App\Contracts\HostedCheckoutGateway;
use App\Contracts\PaymentGateway;
use App\Models\Appointment;
use App\Models\AppointmentPayment;
use App\Models\Shop;
use App\Models\ShopService;
use App\Models\ShopStaff;
use App\Models\User;
use App\Services\Payments\IyzicoPaymentGateway;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Iyzipay\ApiResource;
use Iyzipay\HttpClient;
use Tests\TestCase;

class IyzicoPaymentFlowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'payments.driver' => 'iyzico',
            'payments.frontend_url' => 'http://localhost:3000',
            'payments.iyzico.callback_url' => null,
            'payments.iyzico.api_key' => 'test-api-key',
            'payments.iyzico.secret_key' => 'test-secret-key',
            'payments.iyzico.base_url' => 'https://sandbox-api.iyzipay.com',
        ]);
    }

    protected function tearDown(): void
    {
        ApiResource::setHttpClient(null);
        parent::tearDown();
    }

    public function test_customer_starts_a_hosted_checkout_without_persisting_identity_details(): void
    {
        [$owner, $customer, $appointment] = $this->appointment();
        $gateway = $this->gateway();
        $gateway->shouldReceive('initializeCheckout')->once()->withArgs(function (
            AppointmentPayment $payment,
            User $buyer,
            array $buyerDetails,
            string $ip,
            string $callbackUrl,
        ) use ($customer, $appointment): bool {
            return $payment->appointment_id === $appointment->id
                && $buyer->id === $customer->id
                && $buyerDetails === [
                    'identityNumber' => '12345678901',
                    'registrationAddress' => 'Moda Mahallesi, Kadıköy',
                ]
                && filter_var($ip, FILTER_VALIDATE_IP) !== false
                && str_ends_with($callbackUrl, '/api/v1/payments/iyzico/callback');
        })->andReturn([
            'token' => 'iyzico-checkout-token',
            'checkoutUrl' => 'https://checkout.iyzico.com/form',
        ]);

        $response = $this->actingAs($customer)->postJson("/api/v1/appointments/{$appointment->id}/checkout", [
            'identityNumber' => '12345678901',
            'registrationAddress' => 'Moda Mahallesi, Kadıköy',
        ])->assertOk()->assertJsonPath('checkoutUrl', 'https://checkout.iyzico.com/form');

        $this->assertDatabaseHas('appointment_payments', [
            'appointment_id' => $appointment->id,
            'provider' => 'iyzico',
            'payment_method' => 'iyzico_checkout_form',
            'payment_intent_id' => 'iyzico-checkout-token',
            'checkout_url' => 'https://checkout.iyzico.com/form',
            'status' => 'pending',
        ]);
        $this->assertArrayNotHasKey('identityNumber', AppointmentPayment::query()->firstOrFail()->getAttributes());
        $this->assertNotEmpty($response->json('checkoutUrl'));
        $this->actingAs($owner)->postJson("/api/v1/appointments/{$appointment->id}/checkout", [])->assertForbidden();
    }

    public function test_provider_callback_verifies_and_records_the_payment_transaction(): void
    {
        [, $customer, $appointment] = $this->appointment();
        $payment = $appointment->payment()->create([
            'provider' => 'iyzico',
            'payment_method' => 'iyzico_checkout_form',
            'payment_intent_id' => 'iyzico-checkout-token',
            'checkout_url' => 'https://checkout.iyzico.com/form',
            'amount' => 750,
            'currency' => 'TRY',
            'status' => 'pending',
        ]);
        $gateway = $this->gateway();
        $gateway->shouldReceive('retrieveCheckout')->once()->withArgs(
            fn (AppointmentPayment $received, string $token) => $received->id === $payment->id && $token === 'iyzico-checkout-token',
        )->andReturn([
            'status' => 'success',
            'paymentId' => 'iyzico-payment-id',
            'transactionId' => 'iyzico-transaction-id',
            'currency' => 'TRY',
            'price' => '750.00',
        ]);

        $this->postJson('/api/v1/payments/iyzico/callback', ['token' => 'iyzico-checkout-token'])
            ->assertRedirect('http://localhost:3000/my-appointments?payment=success');

        $this->assertDatabaseHas('appointment_payments', [
            'id' => $payment->id,
            'provider_payment_id' => 'iyzico-payment-id',
            'transaction_id' => 'iyzico-transaction-id',
            'status' => 'paid',
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'actor_user_id' => $customer->id,
            'action' => 'appointment.payment_captured',
            'subject_id' => (string) $appointment->id,
        ]);
    }

    public function test_successful_payment_for_an_already_cancelled_appointment_is_automatically_refunded(): void
    {
        [$owner, , $appointment] = $this->appointment();
        $appointment->update([
            'status' => 'cancelled',
            'cancelled_by_user_id' => $owner->id,
            'cancelled_at' => now(),
            'cancellation_reason' => 'Personel müsait değil',
        ]);
        $payment = $appointment->payment()->create([
            'provider' => 'iyzico',
            'payment_method' => 'iyzico_checkout_form',
            'payment_intent_id' => 'iyzico-checkout-token',
            'amount' => 750,
            'currency' => 'TRY',
            'status' => 'pending',
        ]);
        $gateway = $this->gateway();
        $gateway->shouldReceive('retrieveCheckout')->once()->andReturn([
            'status' => 'success',
            'paymentId' => 'iyzico-payment-id',
            'transactionId' => 'iyzico-transaction-id',
            'currency' => 'TRY',
            'price' => '750.00',
        ]);
        $gateway->shouldReceive('refund')->once()->withArgs(fn (AppointmentPayment $refunding) => $refunding->transaction_id === 'iyzico-transaction-id')
            ->andReturn('iyzico-refund-reference');

        $this->postJson('/api/v1/payments/iyzico/callback', ['token' => 'iyzico-checkout-token'])
            ->assertRedirect('http://localhost:3000/my-appointments?payment=refunded');

        $this->assertDatabaseHas('appointment_payments', [
            'id' => $payment->id,
            'status' => 'refunded',
            'provider_refund_id' => 'iyzico-refund-reference',
        ]);
    }

    public function test_customer_can_retry_checkout_verification_after_a_delayed_provider_callback(): void
    {
        [, $customer, $appointment] = $this->appointment();
        $payment = $appointment->payment()->create([
            'provider' => 'iyzico',
            'payment_method' => 'iyzico_checkout_form',
            'payment_intent_id' => 'iyzico-checkout-token',
            'amount' => 750,
            'currency' => 'TRY',
            'status' => 'pending',
        ]);
        $gateway = $this->gateway();
        $gateway->shouldReceive('retrieveCheckout')->once()->withArgs(
            fn (AppointmentPayment $received, string $token) => $received->id === $payment->id && $token === 'iyzico-checkout-token',
        )->andReturn([
            'status' => 'success',
            'paymentId' => 'iyzico-payment-id',
            'transactionId' => 'iyzico-transaction-id',
            'currency' => 'TRY',
            'price' => '750.00',
        ]);

        $this->actingAs($customer)->postJson("/api/v1/appointments/{$appointment->id}/checkout/verify")
            ->assertOk()
            ->assertJsonPath('payment.status', 'paid');
        $this->assertDatabaseHas('appointment_payments', [
            'id' => $payment->id,
            'transaction_id' => 'iyzico-transaction-id',
            'status' => 'paid',
        ]);
    }

    public function test_official_sdk_initializes_and_verifies_signed_checkout_responses(): void
    {
        [, $customer, $appointment] = $this->appointment();
        $payment = $appointment->payment()->create([
            'provider' => 'iyzico',
            'payment_method' => 'iyzico_checkout_form',
            'amount' => 750,
            'currency' => 'TRY',
            'status' => 'pending',
        ]);
        $basketId = 'appointment-payment-'.$payment->id;
        $paymentStatus = 'SUCCESS';
        $paymentId = 'iyzico-payment-id';
        $price = '750.00';
        $paidPrice = '750.00';
        $token = 'signed-checkout-token';
        $initialSignature = hash_hmac('sha256', $payment->id.':'.$token, 'test-secret-key');
        $resultSignature = hash_hmac(
            'sha256',
            implode(':', [$paymentStatus, $paymentId, 'TRY', $basketId, (string) $payment->id, $paidPrice, $price, $token]),
            'test-secret-key',
        );
        $client = \Mockery::mock(HttpClient::class);
        $client->shouldReceive('post')->twice()->andReturn(
            json_encode([
                'status' => 'success',
                'conversationId' => (string) $payment->id,
                'token' => $token,
                'paymentPageUrl' => 'https://checkout.iyzico.com/form',
                'signature' => $initialSignature,
            ], JSON_THROW_ON_ERROR),
            json_encode([
                'status' => 'success',
                'paymentStatus' => $paymentStatus,
                'paymentId' => $paymentId,
                'currency' => 'TRY',
                'basketId' => $basketId,
                'conversationId' => (string) $payment->id,
                'paidPrice' => $paidPrice,
                'price' => $price,
                'token' => $token,
                'signature' => $resultSignature,
                'itemTransactions' => [[
                    'paymentTransactionId' => 'iyzico-transaction-id',
                ]],
            ], JSON_THROW_ON_ERROR),
        );
        ApiResource::setHttpClient($client);

        $gateway = app(IyzicoPaymentGateway::class);
        $checkout = $gateway->initializeCheckout(
            $payment,
            $customer,
            ['identityNumber' => '12345678901', 'registrationAddress' => 'Moda Mahallesi, Kadıköy'],
            '127.0.0.1',
            'https://api.example.test/api/v1/payments/iyzico/callback',
        );
        $this->assertSame($token, $checkout['token']);
        $this->assertSame('https://checkout.iyzico.com/form', $checkout['checkoutUrl']);

        $payment->update(['payment_intent_id' => $token]);
        $verified = $gateway->retrieveCheckout($payment->refresh(), $token);
        $this->assertSame('success', $verified['status']);
        $this->assertSame('iyzico-transaction-id', $verified['transactionId']);
        $this->assertSame('750.00', $verified['price']);
    }

    public function test_shop_cancellation_uses_the_iyzico_transaction_reference_and_stable_refund_key(): void
    {
        [$owner, , $appointment] = $this->appointment();
        $payment = $appointment->payment()->create([
            'provider' => 'iyzico',
            'provider_payment_id' => 'iyzico-payment-id',
            'transaction_id' => 'iyzico-transaction-id',
            'payment_method' => 'iyzico_checkout_form',
            'refund_idempotency_key' => '11111111-1111-4111-8111-111111111111',
            'amount' => 750,
            'currency' => 'TRY',
            'status' => 'paid',
        ]);
        $client = \Mockery::mock(HttpClient::class);
        $refundKey = null;
        $client->shouldReceive('post')->once()->withArgs(function ($url, $headers, $content) use (&$refundKey): bool {
            $body = json_decode($content, true);
            $refundKey = $body['conversationId'] ?? null;

            return str_ends_with($url, '/payment/refund')
                && $body['paymentTransactionId'] === 'iyzico-transaction-id'
                && is_numeric($body['price'])
                && (float) $body['price'] === 750.0
                && $body['currency'] === 'TRY'
                && is_string($refundKey)
                && Str::isUuid($refundKey);
        })->andReturnUsing(function ($url, $headers, $content): string {
            $body = json_decode($content, true);

            return json_encode([
                'status' => 'success',
                'conversationId' => $body['conversationId'],
                'paymentId' => 'iyzico-payment-id',
                'paymentTransactionId' => 'iyzico-transaction-id',
                'price' => '750.00',
                'currency' => 'TRY',
            ], JSON_THROW_ON_ERROR);
        });
        ApiResource::setHttpClient($client);

        $this->actingAs($owner)->postJson("/api/v1/shop/appointments/{$appointment->id}/cancel")
            ->assertOk()
            ->assertJsonPath('payment.status', 'refunded');

        $this->assertDatabaseHas('appointment_payments', [
            'id' => $payment->id,
            'provider_refund_id' => $refundKey,
            'refund_idempotency_key' => $refundKey,
            'status' => 'refunded',
        ]);
    }

    private function gateway(): PaymentGateway&HostedCheckoutGateway
    {
        $gateway = \Mockery::mock(PaymentGateway::class, HostedCheckoutGateway::class);
        $this->app->instance(PaymentGateway::class, $gateway);

        return $gateway;
    }

    /**
     * @return array{User, User, Appointment}
     */
    private function appointment(): array
    {
        $owner = $this->user('shop_owner', 'Shop Owner');
        $customer = $this->user('customer', 'Ayşe Müşteri');
        $shop = Shop::query()->create([
            'owner_user_id' => $owner->id,
            'slug' => 'iyzico-shop',
            'name' => 'Iyzico Shop',
            'status' => 'active',
            'is_approved' => true,
            'city' => 'İstanbul',
            'district' => 'Kadıköy',
        ]);
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

    private function user(string $role, string $name): User
    {
        return User::query()->create([
            'name' => $name,
            'email' => str_replace(' ', '-', strtolower($name)).'-'.uniqid().'@example.test',
            'password' => Hash::make('long-test-password'),
            'role' => $role,
            'status' => 'active',
            'phone' => '05321234567',
            'city' => 'İstanbul',
            'district' => 'Kadıköy',
        ]);
    }
}
