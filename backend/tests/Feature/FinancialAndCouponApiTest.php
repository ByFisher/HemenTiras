<?php

namespace Tests\Feature;

use App\Models\Coupon;
use App\Models\FinancialLog;
use App\Models\Shop;
use App\Models\ShopService;
use App\Models\ShopStaff;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class FinancialAndCouponApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_shop_coupon_is_pending_and_its_full_budget_must_fit_available_balance(): void
    {
        $owner = $this->user('shop_owner');
        $shop = $this->shop($owner);
        $secondShop = $this->shop($this->user('shop_owner'), 'second-shop');
        $this->financialLog($shop, 'payment', 500);

        $response = $this->actingAs($owner)->postJson('/api/v1/shop/coupons', [
            ...$this->couponInput(),
            'code' => 'SAVE100',
            'shop_id' => $secondShop->id,
        ])
            ->assertCreated()
            ->assertJsonPath('status', 'pending')
            ->assertJsonPath('reservedBudget', 200);
        $couponId = $response->json('id');

        $this->assertDatabaseHas('coupons', [
            'shop_id' => $shop->id,
            'created_by_user_id' => $owner->id,
            'created_by_role' => 'shop_owner',
            'code' => 'SAVE100',
            'status' => 'pending',
            'reserved_budget' => 200,
        ]);
        $this->actingAs($this->user('super_admin'))
            ->postJson("/api/v1/admin/coupons/{$couponId}/approve")
            ->assertOk()
            ->assertJsonPath('status', 'active');
        $this->actingAs($this->user('customer'))->postJson('/api/v1/coupons/validate', [
            'shop_id' => $shop->id,
            'code' => 'SAVE100',
            'basket_amount' => 750,
        ])->assertOk()
            ->assertJsonPath('discountAmount', 100);

        $this->financialLog($secondShop, 'payment', 199);
        $secondOwner = $secondShop->owner;
        $this->actingAs($secondOwner)->postJson('/api/v1/shop/coupons', [
            ...$this->couponInput(),
            'code' => 'TOO-MUCH',
        ])->assertUnprocessable();
    }

    public function test_super_admin_creates_active_global_coupons_and_customers_can_validate_them(): void
    {
        $admin = $this->user('super_admin');
        $customer = $this->user('customer');
        $shop = $this->shop($this->user('shop_owner'));

        $this->actingAs($admin)->postJson('/api/v1/admin/coupons', [
            'code' => 'WELCOME100',
            'discount_type' => 'fixed',
            'discount_value' => 100,
            'min_basket_amount' => 500,
            'usage_limit' => 10,
            'expires_at' => now()->addWeek()->toISOString(),
        ])->assertCreated()->assertJsonPath('status', 'active');

        $this->actingAs($customer)->postJson('/api/v1/coupons/validate', [
            'shop_id' => $shop->id,
            'code' => 'welcome100',
            'basket_amount' => 750,
        ])->assertOk()
            ->assertJsonPath('discountAmount', 100)
            ->assertJsonPath('totalPrice', 650);

        $this->actingAs($this->user('admin'))->postJson('/api/v1/admin/coupons', [
            'discount_type' => 'fixed',
            'discount_value' => 100,
            'usage_limit' => 1,
            'expires_at' => now()->addWeek()->toISOString(),
        ])->assertForbidden();
    }

    public function test_expired_coupons_are_marked_and_listed_by_the_admin_queue(): void
    {
        $admin = $this->user('super_admin');
        $coupon = Coupon::query()->create([
            ...$this->couponInput(),
            'code' => 'PAST-DUE',
            'created_by_role' => 'super_admin',
            'created_by_user_id' => $admin->id,
            'shop_id' => null,
            'reserved_budget' => 0,
            'status' => 'active',
            'expires_at' => now()->subMinute(),
        ]);

        $this->actingAs($admin)->getJson('/api/v1/admin/coupons?status=expired')
            ->assertOk()
            ->assertJsonPath('data.0.status', 'expired');
        $this->assertDatabaseHas('coupons', ['id' => $coupon->id, 'status' => 'expired']);
    }

    public function test_repair_migration_recreates_coupons_when_the_table_is_missing(): void
    {
        Schema::drop('coupons');
        $migration = require database_path('migrations/2026_10_02_160000_repair_missing_coupons_table.php');

        $migration->up();

        $this->assertTrue(Schema::hasColumns('coupons', [
            'code',
            'created_by_role',
            'created_by_user_id',
            'shop_id',
            'discount_type',
            'discount_value',
            'max_discount_amount',
            'min_basket_amount',
            'usage_limit',
            'used_count',
            'reserved_budget',
            'status',
            'expires_at',
            'reviewed_by',
            'reviewed_at',
            'created_at',
            'updated_at',
        ]));
    }

    public function test_coupon_codes_are_normalized_and_invalid_punctuation_has_a_clear_error(): void
    {
        $admin = $this->user('super_admin');

        $this->actingAs($admin)->postJson('/api/v1/admin/coupons', [
            'code' => ' fırsat 10 ',
            'discount_type' => 'fixed',
            'discount_value' => 100,
            'usage_limit' => 10,
            'expires_at' => now()->addWeek()->toISOString(),
        ])->assertCreated()->assertJsonPath('code', 'FIRSAT10');

        $this->actingAs($admin)->postJson('/api/v1/admin/coupons', [
            'code' => 'SAVE!10',
            'discount_type' => 'fixed',
            'discount_value' => 100,
            'usage_limit' => 10,
            'expires_at' => now()->addWeek()->toISOString(),
        ])->assertUnprocessable()
            ->assertJsonPath('errors.code.0', 'Kupon kodu yalnızca harf, rakam, tire ve alt çizgi içerebilir.');
    }

    public function test_owner_can_only_read_its_own_financial_history_and_coupon_reserve_is_excluded(): void
    {
        $owner = $this->user('shop_owner');
        $shop = $this->shop($owner);
        $otherShop = $this->shop($this->user('shop_owner'), 'other-shop');
        $this->financialLog($shop, 'payment', 1000);
        $this->financialLog($shop, 'commission', -100);
        $this->financialLog($otherShop, 'payment', 9000);

        Coupon::query()->create([
            ...$this->couponInput(),
            'code' => 'RESERVE',
            'created_by_role' => 'shop_owner',
            'created_by_user_id' => $owner->id,
            'shop_id' => $shop->id,
            'reserved_budget' => 200,
            'status' => 'pending',
        ]);

        $this->actingAs($owner)->getJson('/api/v1/shop/financial-logs')
            ->assertOk()
            ->assertJsonPath('availableBalance', 700)
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.shopId', (string) $shop->id)
            ->assertJsonPath('data.0.userName', null);

        $this->actingAs($this->user('customer'))->getJson('/api/v1/shop/financial-logs')
            ->assertForbidden();

        $this->actingAs($this->user('super_admin'))->getJson('/api/v1/admin/financial-logs?type=payment')
            ->assertOk()
            ->assertJsonCount(2, 'data');
        $this->actingAs($this->user('admin'))->getJson('/api/v1/admin/financial-logs')
            ->assertForbidden();
    }

    public function test_multi_service_booking_uses_combined_duration_and_applies_coupon(): void
    {
        $owner = $this->user('shop_owner');
        $customer = $this->user('customer');
        $shop = $this->shop($owner);
        $date = now()->addDays(2)->startOfDay();
        $dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
        $staff = ShopStaff::query()->create([
            'shop_id' => $shop->id,
            'first_name' => 'Ali',
            'last_name' => 'Usta',
            'title' => 'Berber',
            'approval_status' => 'approved',
            'working_hours' => [[
                'day' => $dayNames[$date->dayOfWeek],
                'enabled' => true,
                'start' => '09:00',
                'end' => '18:00',
            ]],
        ]);
        $services = collect([
            ['name' => 'Saç kesimi', 'duration_minutes' => 30, 'price' => 500],
            ['name' => 'Sakal düzeltme', 'duration_minutes' => 15, 'price' => 250],
        ])->map(fn (array $data) => ShopService::query()->create([
            'shop_id' => $shop->id,
            ...$data,
            'is_active' => true,
        ]));
        $this->getJson('/api/v1/shops/'.$shop->id.'/staff/'.$staff->id.'/availability?service_ids='.$services->pluck('id')->implode(',').'&date='.$date->toDateString())
            ->assertOk()
            ->assertJsonPath('0.endsAt', Carbon::parse($date->toDateString().' 09:45:00')->toISOString());
        $coupon = Coupon::query()->create([
            ...$this->couponInput(),
            'code' => 'MULTI100',
            'created_by_role' => 'super_admin',
            'created_by_user_id' => $this->user('super_admin')->id,
            'shop_id' => null,
            'reserved_budget' => 0,
            'status' => 'active',
        ]);
        $startsAt = $date->copy()->setTime(13, 0);

        $this->actingAs($customer)->postJson('/api/v1/appointments', [
            'shopId' => $shop->id,
            'staffId' => $staff->id,
            'serviceIds' => $services->pluck('id')->map(fn ($id) => (string) $id)->all(),
            'startsAt' => $startsAt->toISOString(),
            'couponCode' => $coupon->code,
            'paymentMethod' => 'cash',
        ])->assertCreated()
            ->assertJsonPath('basePrice', 750)
            ->assertJsonPath('discountAmount', 100)
            ->assertJsonPath('totalPrice', 650)
            ->assertJsonPath('payment.provider', 'offline')
            ->assertJsonPath('payment.method', 'cash')
            ->assertJsonCount(2, 'services')
            ->assertJsonPath('endsAt', $startsAt->copy()->addMinutes(45)->toISOString());

        $this->assertDatabaseHas('coupon_usages', [
            'coupon_id' => $coupon->id,
            'user_id' => $customer->id,
            'discount_amount' => 100,
        ]);
        $this->assertDatabaseCount('appointment_services', 2);
        $this->assertDatabaseHas('appointment_payments', [
            'provider' => 'offline',
            'payment_method' => 'cash',
            'amount' => 650,
            'payment_status' => 'pending',
        ]);
    }

    private function couponInput(): array
    {
        return [
            'discount_type' => 'fixed',
            'discount_value' => 100,
            'min_basket_amount' => 0,
            'usage_limit' => 2,
            'expires_at' => now()->addWeek()->toISOString(),
        ];
    }

    private function financialLog(Shop $shop, string $type, int $amount): FinancialLog
    {
        return $shop->financialLogs()->create([
            'type' => $type,
            'amount' => $amount,
            'description' => 'Feature test ledger entry',
        ]);
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

    private function shop(User $owner, string $slug = 'finance-shop'): Shop
    {
        return Shop::query()->create([
            'owner_user_id' => $owner->id,
            'slug' => $slug,
            'name' => 'Finance Shop',
            'status' => 'active',
            'is_approved' => true,
            'city' => 'İstanbul',
            'district' => 'Kadıköy',
        ]);
    }
}
