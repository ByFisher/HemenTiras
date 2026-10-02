<?php

namespace Tests\Feature;

use App\Models\AccessLog;
use App\Models\Appointment;
use App\Models\Shop;
use App\Models\ShopStaff;
use App\Models\SponsorApprovalRequest;
use App\Models\StaffReview;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class LegalAccessAndAdminRolesTest extends TestCase
{
    use RefreshDatabase;

    public function test_anonymous_requests_are_logged_without_query_strings_and_receive_a_visitor_id(): void
    {
        config(['app.timezone' => 'Europe/Istanbul']);
        $response = $this->withHeaders(['User-Agent' => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile'])
            ->getJson('/api/v1/shops?secret=must-not-be-logged')
            ->assertOk();
        $cookie = collect($response->headers->getCookies())->first(fn ($cookie) => $cookie->getName() === 'ht_visitor_id');
        $this->assertNotNull($cookie);
        $visitorId = $cookie->getValue();
        $log = AccessLog::query()->firstOrFail();

        $this->assertSame($visitorId, $log->anonymous_visitor_id);
        $this->assertSame('mobile', $log->device_type);
        $this->assertSame('GET', $log->http_method);
        $this->assertSame('/api/v1/shops', $log->request_path);
        $this->assertStringEndsWith('+03:00', $log->occurred_at_local);
        $this->assertNull($log->user_id);
        $this->assertNull($log->explicit_consent_granted);

        $this->getJson('/api/v1/admin/staff')->assertUnauthorized();
        $this->assertDatabaseHas('access_logs', [
            'request_path' => '/api/v1/admin/staff',
            'response_status' => 401,
        ]);
    }

    public function test_anonymous_notice_and_explicit_consent_are_snapshotted_into_later_access_logs(): void
    {
        config([
            'privacy.notice_version' => '2026-10-v1',
            'privacy.explicit_consent_versions.marketing' => 'marketing-v2',
        ]);
        $visitorId = (string) Str::uuid();
        $this->withCredentials()->withUnencryptedCookie('ht_visitor_id', $visitorId)
            ->postJson('/api/v1/privacy/consents', [
                'privacy_notice_version' => '2026-10-v1',
                'notice_acknowledged' => true,
                'explicit_consent' => [
                    'purpose' => 'marketing',
                    'version' => 'marketing-v2',
                    'granted' => false,
                ],
            ])
            ->assertCreated();
        $this->withCredentials()->withUnencryptedCookie('ht_visitor_id', $visitorId)
            ->postJson('/api/v1/privacy/consents', [
                'privacy_notice_version' => 'unpublished-version',
                'notice_acknowledged' => true,
            ])
            ->assertUnprocessable();

        $this->getJson('/api/v1/shops')->assertOk();
        $log = AccessLog::query()->where('http_method', 'GET')->latest('id')->firstOrFail();
        $this->assertSame('2026-10-v1', $log->privacy_notice_version);
        $this->assertNotNull($log->notice_acknowledged_at);
        $this->assertSame('marketing', $log->explicit_consent_purpose);
        $this->assertSame('marketing-v2', $log->explicit_consent_version);
        $this->assertFalse($log->explicit_consent_granted);
        $this->assertNotNull($log->explicit_consent_at);
    }

    public function test_super_admin_can_create_admin_accounts_but_other_admin_roles_cannot(): void
    {
        $superAdmin = $this->user('super_admin');
        $payload = [
            'name' => 'Deniz Yönetici',
            'email' => 'deniz.admin@example.test',
            'phone' => '+90 555 000 0000',
            'password' => 'secure-admin-password',
            'role' => 'moderator',
        ];

        $this->actingAs($this->user('admin'))->postJson('/api/v1/admin/staff', $payload)->assertForbidden();
        $this->actingAs($this->user('moderator'))->postJson('/api/v1/admin/staff', $payload)->assertForbidden();
        $this->actingAs($superAdmin)->postJson('/api/v1/admin/staff', $payload)
            ->assertCreated()
            ->assertJsonPath('role', 'moderator');

        $created = User::query()->where('email', $payload['email'])->firstOrFail();
        $this->assertTrue(Hash::check($payload['password'], $created->password));
        $this->assertDatabaseHas('audit_logs', ['action' => 'admin.staff_created', 'subject_id' => (string) $created->id]);
    }

    public function test_super_admin_can_change_roles_without_removing_the_last_active_super_admin(): void
    {
        $superAdmin = $this->user('super_admin');
        $customer = $this->user('customer');

        $this->actingAs($superAdmin)->patchJson("/api/v1/admin/staff/{$customer->id}/role", ['role' => 'moderator'])
            ->assertOk()->assertJsonPath('role', 'moderator');
        $this->actingAs($superAdmin)->patchJson("/api/v1/admin/staff/{$superAdmin->id}/role", ['role' => 'admin'])
            ->assertConflict();
        $this->assertDatabaseHas('users', ['id' => $superAdmin->id, 'role' => 'super_admin', 'status' => 'active']);
    }

    public function test_admin_and_moderator_permissions_are_separated_from_legal_log_access(): void
    {
        $admin = $this->user('admin');
        $moderator = $this->user('moderator');
        $sponsor = $this->user('sponsor');
        $supportRequest = SponsorApprovalRequest::query()->create([
            'sponsor_user_id' => $sponsor->id,
            'kind' => 'support',
            'title' => 'Hesap desteği',
            'details' => 'Hesap erişimi için yardım gerekiyor.',
        ]);
        $campaignRequest = SponsorApprovalRequest::query()->create([
            'sponsor_user_id' => $sponsor->id,
            'kind' => 'campaign',
            'title' => 'Kampanya',
            'details' => 'Kampanya talebi.',
        ]);

        $this->actingAs($admin)->getJson('/api/v1/admin/shops')->assertOk();
        $this->actingAs($moderator)->getJson('/api/v1/admin/reviews')->assertOk();
        $this->actingAs($moderator)->getJson('/api/v1/admin/support-requests')
            ->assertOk()->assertJsonCount(1)->assertJsonPath('0.kind', 'support');
        $this->actingAs($moderator)->postJson("/api/v1/admin/support-requests/{$campaignRequest->id}/approve")->assertNotFound();
        $this->actingAs($moderator)->postJson("/api/v1/admin/support-requests/{$supportRequest->id}/approve")
            ->assertOk()->assertJsonPath('status', 'Yanıtlandı');
        $this->actingAs($admin)->getJson('/api/v1/admin/access-logs')->assertForbidden();
        $this->actingAs($moderator)->getJson('/api/v1/admin/access-logs')->assertForbidden();
        $this->assertDatabaseHas('sponsor_approval_requests', ['id' => $campaignRequest->id, 'status' => 'pending_approval']);
    }

    public function test_only_super_admin_can_export_logs_and_csv_cells_are_formula_safe(): void
    {
        $log = AccessLog::query()->create([
            'anonymous_visitor_id' => (string) Str::uuid(),
            'ip_address' => '192.0.2.10',
            'occurred_at_utc' => now('UTC'),
            'occurred_at_local' => now('Europe/Istanbul')->toIso8601String(),
            'device_type' => 'desktop',
            'http_method' => 'GET',
            'request_path' => '=1+1',
            'response_status' => 200,
        ]);

        $this->actingAs($this->user('admin'))->get('/api/v1/admin/access-logs/export')->assertForbidden();
        $this->actingAs($this->user('super_admin'))
            ->getJson('/api/v1/admin/access-logs?ip=192.0.2.10&device_type=desktop&method=GET')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', (string) $log->id);
        $response = $this->actingAs($this->user('super_admin'))->get('/api/v1/admin/access-logs/export')
            ->assertOk()
            ->assertHeader('content-type', 'text/csv; charset=UTF-8');

        $this->assertStringContainsString("'=1+1", $response->streamedContent());
        $this->assertDatabaseHas('access_logs', ['id' => $log->id]);
    }

    public function test_new_reviews_are_held_for_moderation_and_only_approved_reviews_are_public(): void
    {
        $moderator = $this->user('moderator');
        $owner = $this->user('shop_owner');
        $customer = $this->user('customer');
        $shop = $owner->shops()->create([
            'name' => 'Moderation Shop',
            'slug' => 'moderation-shop',
            'description' => '',
            'status' => 'active',
            'is_approved' => true,
            'city' => 'İstanbul',
            'district' => 'Kadıköy',
            'street' => 'Test Caddesi 1',
            'phone' => '05550000000',
        ]);
        $staff = ShopStaff::query()->create([
            'shop_id' => $shop->id,
            'first_name' => 'Ali',
            'last_name' => 'Usta',
            'title' => 'Berber',
            'approval_status' => 'approved',
        ]);
        $appointment = $this->appointment($customer, $shop, $staff);
        $reviewResponse = $this->actingAs($customer)
            ->postJson("/api/v1/appointments/{$appointment->id}/review", [
                'rating' => 5,
                'comment' => 'Bekleyen yorum',
            ])
            ->assertCreated()
            ->assertJsonPath('status', 'pending_approval');
        $review = StaffReview::query()->findOrFail($reviewResponse->json('id'));
        $this->actingAs($customer)
            ->postJson("/api/v1/appointments/{$appointment->id}/review", ['rating' => 5])
            ->assertConflict();

        $this->getJson("/api/v1/shops/{$shop->id}/staff/{$staff->id}/reviews")
            ->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($moderator)->getJson('/api/v1/admin/reviews?status=pending_approval')
            ->assertOk()->assertJsonPath('data.0.id', (string) $review->id);
        $this->actingAs($moderator)->patchJson("/api/v1/admin/reviews/{$review->id}/approve")
            ->assertOk()->assertJsonPath('status', 'approved');
        $this->getJson("/api/v1/shops/{$shop->id}/staff/{$staff->id}/reviews")
            ->assertOk()->assertJsonPath('data.0.comment', 'Bekleyen yorum');
    }

    private function user(string $role): User
    {
        return User::factory()->create([
            'role' => $role,
            'status' => 'active',
        ]);
    }

    private function appointment(User $customer, Shop $shop, ShopStaff $staff): Appointment
    {
        $service = $shop->services()->create([
            'name' => 'Kesim',
            'category' => 'Saç',
            'duration_minutes' => 30,
            'price' => 500,
        ]);

        return $customer->appointments()->create([
            'shop_id' => $shop->id,
            'staff_id' => $staff->id,
            'service_id' => $service->id,
            'starts_at' => now()->subDay(),
            'ends_at' => now()->subDay()->addMinutes(30),
            'status' => 'completed',
            'total_price' => 500,
        ]);
    }
}
