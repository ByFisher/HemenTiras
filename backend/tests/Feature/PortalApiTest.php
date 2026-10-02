<?php

namespace Tests\Feature;

use App\Models\Shop;
use App\Models\ShopService;
use App\Models\ShopStaff;
use App\Models\User;
use Database\Seeders\AdminUserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PortalApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_management_endpoints_require_an_authenticated_role(): void
    {
        $this->getJson('/api/v1/admin/users')->assertUnauthorized();
        $this->getJson('/api/v1/shop/services')->assertUnauthorized();
        $this->getJson('/api/v1/shops')->assertOk();
        $this->postJson('/api/v1/appointments', [])->assertUnauthorized();
        $this->getJson('/api/v1/user/favorites')->assertUnauthorized();
        $this->putJson('/api/v1/user/profile', ['fullName' => 'Customer'])->assertUnauthorized();
        $this->getJson('/api/v1/user/active-appointments')->assertUnauthorized();
    }

    public function test_guests_can_read_approved_shop_details_services_staff_and_reviews(): void
    {
        $owner = $this->user('shop_owner', 'Guest Shop Owner', 'guest-shop-owner@example.test');
        $shop = $this->shop($owner, 'guest-public-shop');
        $shop->update(['is_approved' => true]);
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
            'category' => 'Saç',
            'duration_minutes' => 30,
            'price' => 500,
        ]);

        $this->getJson('/api/v1/shops')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.services.0.id', (string) $service->id)
            ->assertJsonPath('data.0.minimumServicePrice', 500);
        $this->getJson("/api/v1/shops/{$shop->id}")->assertOk()->assertJsonPath('name', $shop->name);
        $this->getJson("/api/v1/shops/slug/{$shop->slug}")->assertOk()->assertJsonPath('id', (string) $shop->id);
        $this->getJson("/api/v1/shops/{$shop->id}/services")
            ->assertOk()->assertJsonPath('0.name', 'Saç kesimi')->assertJsonPath('0.price', 500);
        $this->getJson("/api/v1/shops/{$shop->id}/staff")
            ->assertOk()->assertJsonPath('0.id', (string) $staff->id);
        $this->getJson("/api/v1/shops/{$shop->id}/staff/{$staff->id}/reviews")->assertOk();
        $this->postJson('/api/v1/appointments', [])->assertUnauthorized();
        $this->putJson("/api/v1/user/favorites/{$shop->id}")->assertUnauthorized();
    }

    public function test_only_customers_can_add_and_remove_shop_favorites(): void
    {
        $owner = $this->user('shop_owner', 'Favorite Shop Owner', 'favorite-shop-owner@example.test');
        $shop = $this->shop($owner, 'favorite-public-shop');
        $shop->update(['is_approved' => true]);
        $customer = $this->user('customer', 'Favorite Customer', 'favorite-customer@example.test');

        $this->actingAs($owner)->putJson("/api/v1/user/favorites/{$shop->id}")->assertForbidden();
        $this->actingAs($customer)->getJson('/api/v1/user/favorites')->assertOk()->assertExactJson([]);
        $this->actingAs($customer)->putJson("/api/v1/user/favorites/{$shop->id}")
            ->assertOk()->assertJsonPath('isFavorite', true);
        $this->actingAs($customer)->putJson("/api/v1/user/favorites/{$shop->id}")
            ->assertOk()->assertJsonPath('isFavorite', true);
        $this->actingAs($customer)->getJson('/api/v1/user/favorites')
            ->assertOk()->assertExactJson([(string) $shop->id]);
        $this->actingAs($customer)->deleteJson("/api/v1/user/favorites/{$shop->id}")
            ->assertOk()->assertJsonPath('isFavorite', false);
        $this->assertDatabaseMissing('shop_favorites', ['user_id' => $customer->id, 'shop_id' => $shop->id]);
    }

    public function test_database_starts_without_demo_accounts(): void
    {
        $this->assertDatabaseCount('users', 0);
    }

    public function test_admin_seeder_creates_the_configured_active_super_admin_idempotently(): void
    {
        app(AdminUserSeeder::class)->run();
        app(AdminUserSeeder::class)->run();

        $this->assertDatabaseCount('users', 1);
        $admin = User::query()->where('email', 'admin@hementiras.com')->firstOrFail();
        $this->assertSame('super_admin', $admin->role);
        $this->assertSame('active', $admin->status);
        $this->assertTrue(Hash::check('Password123!', $admin->password));
    }

    public function test_login_creates_a_session_and_logout_invalidates_it(): void
    {
        $this->user('customer', 'Customer', 'customer@example.test');
        $this->withHeaders([
            'Origin' => 'http://localhost:3000',
            'Referer' => 'http://localhost:3000/login',
        ])->postJson('/api/v1/auth/login', [
            'email' => 'customer@example.test',
            'password' => 'long-test-password',
        ])->assertOk()->assertJsonPath('role', 'customer');

        $this->getJson('/api/v1/me')->assertOk();
        $this->postJson('/api/v1/auth/logout')->assertOk();
        $this->assertGuest();
    }

    public function test_authenticated_user_can_update_profile_and_upload_avatar(): void
    {
        $customer = $this->user('customer', 'Old Customer', 'profile@example.test');
        Storage::fake('public');

        $response = $this->actingAs($customer)->post('/api/v1/user/profile', [
            '_method' => 'PUT',
            'fullName' => 'Updated Customer',
            'phone' => '05321234567',
            'avatar' => UploadedFile::fake()->image('profile.png'),
        ], ['Accept' => 'application/json'])->assertOk()
            ->assertJsonPath('fullName', 'Updated Customer')
            ->assertJsonPath('phone', '05321234567');

        $this->assertDatabaseHas('users', [
            'id' => $customer->id,
            'name' => 'Updated Customer',
            'phone' => '05321234567',
        ]);
        $this->assertStringContainsString('/storage/avatars/', $response->json('avatarUrl'));
        $this->assertNotEmpty(Storage::disk('public')->allFiles('avatars'));
    }

    public function test_customer_active_appointments_endpoint_returns_upcoming_and_recent_statuses(): void
    {
        $customer = $this->user('customer', 'Reminder Customer', 'reminder@example.test');
        $owner = $this->user('shop_owner', 'Reminder Shop Owner', 'reminder-owner@example.test');
        $shop = $this->shop($owner, 'reminder-shop');
        $shop->update(['is_approved' => true]);
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
            'price' => 500,
        ]);
        $appointment = $customer->appointments()->create([
            'shop_id' => $shop->id,
            'staff_id' => $staff->id,
            'service_id' => $service->id,
            'starts_at' => now()->addMinutes(30),
            'ends_at' => now()->addMinutes(60),
            'status' => 'confirmed',
            'total_price' => 500,
        ]);

        $this->actingAs($customer)->getJson('/api/v1/user/active-appointments')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.id', (string) $appointment->id)
            ->assertJsonPath('0.status', 'confirmed')
            ->assertJsonPath('0.shop.name', $shop->name);
    }

    public function test_public_registration_creates_a_customer_and_authenticates_the_session(): void
    {
        $this->withHeaders([
            'Origin' => 'http://localhost:3000',
            'Referer' => 'http://localhost:3000/register',
        ])->postJson('/api/v1/auth/register', [
            'name' => 'New Customer',
            'email' => 'new@example.test',
            'phone' => '05321234567',
            'city' => 'İstanbul',
            'district' => 'Kadıköy',
            'password' => 'customer-password-123',
            'password_confirmation' => 'customer-password-123',
        ])->assertCreated()
            ->assertJsonPath('role', 'customer')
            ->assertJsonPath('status', 'active')
            ->assertJsonPath('city', 'İstanbul')
            ->assertJsonPath('district', 'Kadıköy');

        $this->assertDatabaseHas('users', [
            'email' => 'new@example.test',
            'role' => 'customer',
            'status' => 'active',
            'city' => 'İstanbul',
            'district' => 'Kadıköy',
        ]);
        $this->getJson('/api/v1/me')->assertOk()->assertJsonPath('role', 'customer');
        $this->getJson('/api/v1/shops')->assertOk();
    }

    public function test_public_location_endpoints_return_the_turkish_city_and_district_catalog(): void
    {
        $this->getJson('/api/v1/locations/cities')
            ->assertOk()
            ->assertJsonCount(81)
            ->assertJsonFragment(['İstanbul'])
            ->assertJsonFragment(['Ankara']);
        $this->getJson('/api/v1/locations/districts?city=İstanbul')
            ->assertOk()
            ->assertJsonFragment(['Kadıköy'])
            ->assertJsonFragment(['Üsküdar'])
            ->assertJsonMissing(['Çankaya']);
        $this->getJson('/api/v1/locations/districts')
            ->assertUnprocessable();
    }

    public function test_customer_registration_requires_a_valid_district_for_the_selected_city(): void
    {
        $this->postJson('/api/v1/auth/register-customer', [
            'fullName' => 'New API Customer',
            'email' => 'invalid-location-customer@example.test',
            'phone' => '05321234567',
            'password' => 'customer-password-123',
            'city' => 'İstanbul',
            'district' => 'Çankaya',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['district']);

        $this->assertDatabaseMissing('users', ['email' => 'invalid-location-customer@example.test']);
    }

    public function test_customer_registration_requires_a_phone_number(): void
    {
        $this->postJson('/api/v1/auth/register-customer', [
            'fullName' => 'Customer Without Phone',
            'email' => 'customer-without-phone@example.test',
            'password' => 'customer-password-123',
            'city' => 'İstanbul',
            'district' => 'Kadıköy',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['phone']);

        $this->assertDatabaseMissing('users', ['email' => 'customer-without-phone@example.test']);
    }

    public function test_shop_search_filters_by_exact_city_and_district(): void
    {
        $customer = $this->user('customer', 'Search Customer', 'search-customer@example.test');
        $owner = $this->user('shop_owner', 'Search Shop Owner', 'search-owner@example.test');
        $matchingShop = $this->shop($owner, 'matching-location-shop');
        $matchingShop->update(['is_approved' => true]);
        $similarDistrictShop = $this->shop($owner, 'similar-district-shop');
        $similarDistrictShop->update(['district' => 'Kadıköy Merkez', 'is_approved' => true]);

        $this->actingAs($customer)->getJson('/api/v1/shops?city=İstanbul&district=Kadıköy')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.id', (string) $matchingShop->id);
    }

    public function test_customer_registration_rejects_invalid_and_duplicate_accounts(): void
    {
        $payload = [
            'name' => 'New Customer',
            'email' => 'new@example.test',
            'password' => 'short',
            'password_confirmation' => 'different',
        ];
        $this->postJson('/api/v1/auth/register', $payload)->assertUnprocessable();
        $this->user('customer', 'Existing Customer', 'new@example.test');
        $this->postJson('/api/v1/auth/register', [
            ...$payload,
            'phone' => '05321234567',
            'city' => 'İstanbul',
            'district' => 'Kadıköy',
            'password' => 'customer-password-123',
            'password_confirmation' => 'customer-password-123',
        ])->assertUnprocessable();
        $this->assertDatabaseCount('users', 1);
    }

    public function test_customer_registration_endpoint_returns_an_active_customer_then_accepts_credentials_login(): void
    {
        $this->postJson('/api/v1/auth/register-customer', [
            'fullName' => 'New API Customer',
            'email' => 'api-customer@example.test',
            'password' => 'customer-password-123',
            'phone' => '05321234567',
            'city' => 'İstanbul',
            'district' => 'Kadıköy',
        ])->assertCreated()
            ->assertJsonPath('role', 'customer')
            ->assertJsonPath('status', 'active')
            ->assertJsonPath('city', 'İstanbul')
            ->assertJsonPath('district', 'Kadıköy');

        $this->assertDatabaseHas('users', [
            'email' => 'api-customer@example.test',
            'city' => 'İstanbul',
            'district' => 'Kadıköy',
        ]);

        $this->assertGuest();
        $this->withHeaders([
            'Origin' => 'http://localhost:3000',
            'Referer' => 'http://localhost:3000/register',
        ])->postJson('/api/v1/auth/login', [
            'email' => 'api-customer@example.test',
            'password' => 'customer-password-123',
        ])->assertOk()->assertJsonPath('role', 'customer');
    }

    public function test_shop_owner_application_waits_for_admin_approval_before_panel_access(): void
    {
        $payload = [
            'name' => 'Shop Owner',
            'email' => 'owner-application@example.test',
            'phone' => '05321234567',
            'password' => 'owner-password-123',
            'password_confirmation' => 'owner-password-123',
            'shopName' => 'Kadıköy Berber',
            'city' => 'İstanbul',
            'district' => 'Kadıköy',
            'address' => 'Moda Caddesi No 1',
            'shopPhone' => '02161234567',
        ];

        $this->postJson('/api/v1/auth/register-shop-owner', $payload)
            ->assertCreated()
            ->assertJsonPath('user.role', 'shop_owner')
            ->assertJsonPath('user.status', 'pending_approval')
            ->assertJsonPath('user.city', 'İstanbul')
            ->assertJsonPath('user.district', 'Kadıköy');

        $owner = User::query()->where('email', $payload['email'])->firstOrFail();
        $this->assertDatabaseHas('users', [
            'id' => $owner->id,
            'city' => 'İstanbul',
            'district' => 'Kadıköy',
        ]);
        $shop = $owner->shops()->firstOrFail();
        $this->assertDatabaseHas('shops', [
            'id' => $shop->id,
            'status' => 'pending_approval',
        ]);
        $this->assertGuest();

        $customer = $this->user('customer', 'Shop Search Customer', 'shop-approval-search@example.test');
        $this->actingAs($customer)->getJson('/api/v1/shops')
            ->assertOk()
            ->assertJsonMissing(['id' => (string) $shop->id]);

        $this->actingAs($owner)->getJson('/api/v1/me')->assertOk()->assertJsonPath('role', 'shop_owner');
        $this->getJson('/api/v1/shop/services')->assertForbidden();

        $admin = $this->user('super_admin', 'Admin', 'approval-admin@example.test');
        $this->actingAs($admin)
            ->patchJson("/api/v1/admin/shops/{$shop->id}/status", ['status' => 'active'])
            ->assertOk()
            ->assertJsonPath('status', 'active');

        $this->assertDatabaseHas('users', [
            'id' => $owner->id,
            'role' => 'shop_owner',
            'status' => 'approved',
        ]);
        $this->assertDatabaseHas('shops', [
            'id' => $shop->id,
            'status' => 'active',
            'is_approved' => true,
        ]);
        $this->actingAs($customer)->getJson('/api/v1/shops')
            ->assertOk()
            ->assertJsonPath('data.0.id', (string) $shop->id);
        $this->actingAs($owner->fresh())->getJson('/api/v1/shop/services')->assertOk();
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'shop.status_changed',
            'subject_id' => (string) $shop->id,
        ]);

        $this->actingAs($admin)
            ->patchJson("/api/v1/admin/shops/{$shop->id}/status", ['status' => 'suspended'])
            ->assertOk();
        $this->assertDatabaseHas('users', ['id' => $owner->id, 'status' => 'suspended']);
        $this->patchJson("/api/v1/admin/users/{$owner->id}/status", ['status' => 'active'])->assertOk();
        $this->actingAs($owner->fresh())->getJson('/api/v1/shop/services')->assertForbidden();
    }

    public function test_pending_shop_owner_can_sign_in_to_check_application_status(): void
    {
        User::query()->create([
            'name' => 'Pending Owner',
            'email' => 'pending-owner@example.test',
            'password' => 'long-test-password',
            'role' => 'shop_owner',
            'status' => 'pending_approval',
        ]);

        $this->withHeaders([
            'Origin' => 'http://localhost:3000',
            'Referer' => 'http://localhost:3000/login',
        ])->postJson('/api/v1/auth/login', [
            'email' => 'pending-owner@example.test',
            'password' => 'long-test-password',
        ])->assertOk()->assertJsonPath('status', 'pending_approval');

        $this->getJson('/api/v1/me')->assertOk()->assertJsonPath('role', 'shop_owner');
    }

    public function test_shop_registration_endpoint_creates_an_unapproved_pending_shop(): void
    {
        $this->postJson('/api/v1/auth/register-shop', [
            'fullName' => 'API Shop Owner',
            'email' => 'api-shop@example.test',
            'password' => 'shop-owner-password-123',
            'shopName' => 'API Shop',
            'phone' => '05329876543',
            'city' => 'İstanbul',
            'district' => 'Beşiktaş',
        ])->assertCreated()
            ->assertJsonPath('user.role', 'shop_owner')
            ->assertJsonPath('user.status', 'pending_approval')
            ->assertJsonPath('user.city', 'İstanbul')
            ->assertJsonPath('user.district', 'Beşiktaş');

        $owner = User::query()->where('email', 'api-shop@example.test')->firstOrFail();
        $this->assertDatabaseHas('users', [
            'id' => $owner->id,
            'city' => 'İstanbul',
            'district' => 'Beşiktaş',
        ]);
        $this->assertDatabaseHas('shops', [
            'owner_user_id' => $owner->id,
            'name' => 'API Shop',
            'status' => 'pending_approval',
            'is_approved' => false,
        ]);
        $this->assertGuest();
    }

    public function test_shop_owner_registration_requires_a_district_in_the_selected_city(): void
    {
        $this->postJson('/api/v1/auth/register-shop', [
            'fullName' => 'Invalid Location Owner',
            'email' => 'invalid-location-owner@example.test',
            'password' => 'shop-owner-password-123',
            'shopName' => 'Invalid Location Shop',
            'phone' => '05329876543',
            'city' => 'İstanbul',
            'district' => 'Çankaya',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['district']);

        $this->assertDatabaseMissing('users', ['email' => 'invalid-location-owner@example.test']);
    }

    public function test_customers_only_see_active_shops_that_have_admin_approval(): void
    {
        $customer = $this->user('customer', 'Shop Search Customer', 'shop-search@example.test');
        $approvedOwner = $this->user('shop_owner', 'Approved Owner', 'approved-owner@example.test');
        $approvedShop = $this->shop($approvedOwner, 'approved-public-shop');
        $approvedShop->update(['is_approved' => true]);

        $unapprovedOwner = $this->user('shop_owner', 'Unapproved Owner', 'unapproved-owner@example.test');
        $unapprovedShop = $this->shop($unapprovedOwner, 'unapproved-public-shop');

        $response = $this->actingAs($customer)->getJson('/api/v1/shops')->assertOk();
        $response->assertJsonPath('data.0.id', (string) $approvedShop->id)
            ->assertJsonPath('data.0.isApproved', true)
            ->assertJsonMissing(['id' => (string) $unapprovedShop->id]);

        $this->getJson("/api/v1/shops/{$unapprovedShop->id}")->assertNotFound();
    }

    public function test_admin_registration_endpoints_return_pending_shops_and_recent_customers(): void
    {
        $admin = $this->user('super_admin', 'Directory Admin', 'directory-admin@example.test');
        $owner = $this->user('shop_owner', 'Pending Shop Owner', 'pending-directory@example.test');
        $pendingShop = $this->shop($owner, 'pending-directory-shop');
        $pendingShop->update(['status' => 'pending_approval']);
        $customer = $this->user('customer', 'Recent Customer', 'recent-customer@example.test');
        $this->user('sponsor', 'Not a Customer', 'not-customer@example.test');

        $this->actingAs($admin)
            ->getJson('/api/v1/admin/pending-approvals')
            ->assertOk()
            ->assertJsonPath('data.0.id', (string) $pendingShop->id)
            ->assertJsonPath('data.0.isApproved', false);

        $this->getJson('/api/v1/admin/recent-users')
            ->assertOk()
            ->assertJsonPath('data.0.id', (string) $customer->id)
            ->assertJsonPath('data.0.role', 'customer')
            ->assertJsonMissing(['role' => 'sponsor']);
    }

    public function test_shop_owner_cannot_read_admin_data(): void
    {
        $owner = $this->user('shop_owner');
        $this->actingAs($owner)->getJson('/api/v1/admin/users')->assertForbidden();
    }

    public function test_admin_user_directory_masks_contact_details(): void
    {
        $admin = $this->user('super_admin');
        $customer = $this->user('customer', 'Ayşe Demir', 'ayse@example.test', '05321234567');

        $response = $this->actingAs($admin)->getJson('/api/v1/admin/users')->assertOk();
        $this->assertTrue(collect($response->json('data'))->contains(
            fn (array $user) => $user['firstName'] === 'Ayşe',
        ));
        $this->assertStringNotContainsString('ayse@example.test', $response->getContent());
        $this->assertStringNotContainsString('05321234567', $response->getContent());
        $this->assertStringNotContainsString('"email"', $response->getContent());
        $this->assertStringNotContainsString('"phone"', $response->getContent());
    }

    public function test_shop_owner_only_sees_and_updates_own_services(): void
    {
        $owner = $this->user('shop_owner');
        $otherOwner = $this->user('shop_owner', 'Other Owner', 'other@example.test');
        $shop = $this->shop($owner);
        $otherShop = $this->shop($otherOwner, 'other');
        ShopService::query()->create([
            'shop_id' => $shop->id,
            'name' => 'Own service',
            'duration_minutes' => 30,
            'price' => 500,
        ]);
        $foreignService = ShopService::query()->create([
            'shop_id' => $otherShop->id,
            'name' => 'Foreign service',
            'duration_minutes' => 30,
            'price' => 700,
        ]);

        $this->actingAs($owner)->getJson('/api/v1/shop/services')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonMissing(['name' => 'Foreign service']);
        $this->patchJson("/api/v1/shop/services/{$foreignService->id}", ['price' => 1])->assertNotFound();
        $this->assertDatabaseHas('shop_services', ['id' => $foreignService->id, 'price' => 700]);
    }

    private function user(string $role, string $name = 'Test User', string $email = 'test@example.test', ?string $phone = null): User
    {
        return User::query()->create([
            'name' => $name,
            'email' => $email,
            'password' => 'long-test-password',
            'role' => $role,
            'status' => 'active',
            'phone' => $phone,
        ]);
    }

    private function shop(User $owner, string $slug = 'test-shop'): Shop
    {
        return Shop::query()->create([
            'owner_user_id' => $owner->id,
            'slug' => $slug,
            'name' => $slug,
            'status' => 'active',
            'city' => 'İstanbul',
            'district' => 'Kadıköy',
        ]);
    }
}
