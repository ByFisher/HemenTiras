<?php

namespace Tests\Feature;

use App\Models\Appointment;
use App\Models\Shop;
use App\Models\ShopService;
use App\Models\ShopStaff;
use App\Models\StaffReview;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ShopModulesApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_shop_owner_can_read_and_update_operating_hours_and_staff_shifts(): void
    {
        [$owner, $shop] = $this->shopOwnerAndShop();
        $schedule = $this->schedule();
        $shop->update(['working_hours' => $schedule]);
        $staff = ShopStaff::query()->create([
            'shop_id' => $shop->id,
            'first_name' => 'Ali',
            'last_name' => 'Usta',
            'title' => 'Berber',
            'approval_status' => 'approved',
            'working_hours' => $schedule,
        ]);

        $this->actingAs($owner)->getJson('/api/v1/shop/hours')
            ->assertOk()
            ->assertJsonPath('workingHours.0.day', 'Pazartesi')
            ->assertJsonPath('shifts.0.id', (string) $staff->id)
            ->assertJsonPath('shifts.0.workingHours.0.start', '09:00');

        $updatedSchedule = $this->schedule();
        $updatedSchedule[0]['start'] = '10:00';
        $this->actingAs($owner)->putJson('/api/v1/shop/hours', ['workingHours' => $updatedSchedule])
            ->assertOk()
            ->assertJsonPath('workingHours.0.start', '10:00');
        $this->assertSame('10:00', $shop->refresh()->working_hours[0]['start']);

        $invalidSchedule = $updatedSchedule;
        $invalidSchedule[0]['end'] = '08:00';
        $this->actingAs($owner)->putJson('/api/v1/shop/hours', ['workingHours' => $invalidSchedule])
            ->assertUnprocessable();
    }

    public function test_shop_owner_can_upload_and_list_gallery_photos_for_their_shop(): void
    {
        [$owner, $shop] = $this->shopOwnerAndShop();
        Storage::fake('local');

        $this->actingAs($owner)->post('/api/v1/shop/content-submissions', [
            'kind' => 'gallery_image',
            'title' => 'Dükkan içi',
            'file' => UploadedFile::fake()->image('gallery.png'),
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('kind', 'gallery_image')
            ->assertJsonPath('approvalStatus', 'pending_approval');

        $this->actingAs($owner)->getJson('/api/v1/shop/gallery')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.title', 'Dükkan içi');

        $otherOwner = $this->user('shop_owner', 'Other Owner');
        $this->createShop($otherOwner, 'another-shop');
        $this->actingAs($otherOwner)->getJson('/api/v1/shop/gallery')->assertExactJson([]);
        $this->assertDatabaseHas('shop_content_submissions', [
            'shop_id' => $shop->id,
            'kind' => 'gallery_image',
        ]);
    }

    public function test_shop_owner_can_read_reviews_for_approved_staff_in_their_shop(): void
    {
        [$owner, $shop] = $this->shopOwnerAndShop();
        $customer = $this->user('customer', 'Ayşe Müşteri');
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
        $appointment = Appointment::query()->create([
            'customer_id' => $customer->id,
            'shop_id' => $shop->id,
            'staff_id' => $staff->id,
            'service_id' => $service->id,
            'starts_at' => now()->subDay(),
            'ends_at' => now()->subDay()->addMinutes(30),
            'status' => 'completed',
            'total_price' => 500,
        ]);
        StaffReview::query()->create([
            'appointment_id' => $appointment->id,
            'staff_id' => $staff->id,
            'customer_id' => $customer->id,
            'rating' => 5,
            'comment' => 'Çok memnun kaldım.',
        ]);

        $this->actingAs($owner)->getJson('/api/v1/shop/reviews')
            ->assertOk()
            ->assertJsonPath('averageRating', 5)
            ->assertJsonPath('reviewCount', 1)
            ->assertJsonPath('reviews.0.customerFirstName', 'Ayşe')
            ->assertJsonPath('reviews.0.staffName', 'Ali Usta')
            ->assertJsonPath('reviews.0.comment', 'Çok memnun kaldım.');

        $this->actingAs($customer)->getJson('/api/v1/shop/reviews')->assertForbidden();
    }

    /**
     * @return array{User, Shop}
     */
    private function shopOwnerAndShop(): array
    {
        $owner = $this->user('shop_owner', 'Shop Owner');

        return [$owner, $this->createShop($owner, 'module-shop')];
    }

    private function createShop(User $owner, string $slug): Shop
    {
        return Shop::query()->create([
            'owner_user_id' => $owner->id,
            'slug' => $slug,
            'name' => 'Module Shop',
            'status' => 'active',
            'is_approved' => true,
            'city' => 'İstanbul',
            'district' => 'Kadıköy',
        ]);
    }

    private function user(string $role, string $name): User
    {
        return User::query()->create([
            'name' => $name,
            'email' => str_replace(' ', '-', strtolower($name)).'-'.uniqid().'@example.test',
            'password' => Hash::make('long-test-password'),
            'role' => $role,
            'status' => 'active',
        ]);
    }

    /**
     * @return list<array{day: string, enabled: bool, start: string, end: string, breakStart: string, breakEnd: string}>
     */
    private function schedule(): array
    {
        return array_map(fn (string $day) => [
            'day' => $day,
            'enabled' => true,
            'start' => '09:00',
            'end' => '18:00',
            'breakStart' => '12:00',
            'breakEnd' => '13:00',
        ], ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']);
    }
}
