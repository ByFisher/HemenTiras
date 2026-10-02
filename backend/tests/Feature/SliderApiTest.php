<?php

namespace Tests\Feature;

use App\Models\Slider;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class SliderApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_endpoint_returns_only_active_slides_in_display_order(): void
    {
        Storage::fake('public');
        $inactive = $this->slider('Inactive banner', false, 0);
        $second = $this->slider('Second banner', true, 2);
        $first = $this->slider('First banner', true, 1);

        $this->getJson('/api/v1/sliders')
            ->assertOk()
            ->assertJsonCount(2)
            ->assertJsonPath('0.id', (string) $first->id)
            ->assertJsonPath('0.title', 'First banner')
            ->assertJsonPath('1.id', (string) $second->id)
            ->assertJsonMissing(['id' => (string) $inactive->id]);
    }

    public function test_slider_management_requires_a_super_admin(): void
    {
        $this->getJson('/api/v1/admin/sliders')->assertUnauthorized();
        $this->actingAs($this->user('shop_owner'))->getJson('/api/v1/admin/sliders')->assertForbidden();
    }

    public function test_super_admin_can_create_edit_reorder_and_delete_slides(): void
    {
        Storage::fake('public');
        $admin = $this->user('super_admin');
        $firstImage = UploadedFile::fake()->image('first.png');
        $first = $this->actingAs($admin)->post('/api/v1/admin/sliders', [
            'title' => 'First banner',
            'description' => 'First description',
            'image' => $firstImage,
            'link_url' => '/shops',
            'link_label' => 'Salonları bul',
            'is_active' => true,
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('title', 'First banner')
            ->assertJsonPath('isActive', true)
            ->assertJsonPath('sortOrder', 0);

        $firstId = $first->json('id');
        $this->assertDatabaseHas('sliders', ['id' => $firstId, 'image_path' => 'sliders/'.$firstImage->hashName()]);
        Storage::disk('public')->assertExists('sliders/'.$firstImage->hashName());

        $second = $this->post('/api/v1/admin/sliders', [
            'title' => 'Second banner',
            'image' => UploadedFile::fake()->image('second.png'),
            'is_active' => true,
        ], ['Accept' => 'application/json'])->assertCreated();
        $secondId = $second->json('id');

        $this->patchJson('/api/v1/admin/sliders/order', ['ids' => [$secondId, $firstId]])
            ->assertOk()
            ->assertJsonPath('0.id', (string) $secondId)
            ->assertJsonPath('0.sortOrder', 0);

        $this->patchJson("/api/v1/admin/sliders/{$firstId}", [
            'title' => 'Updated banner',
            'is_active' => false,
        ])->assertOk()->assertJsonPath('title', 'Updated banner')->assertJsonPath('isActive', false);

        $this->deleteJson("/api/v1/admin/sliders/{$firstId}")->assertNoContent();
        $this->assertDatabaseMissing('sliders', ['id' => $firstId]);
        Storage::disk('public')->assertMissing('sliders/'.$firstImage->hashName());
    }

    public function test_admin_rejects_unsafe_links_and_incomplete_order_requests(): void
    {
        $admin = $this->user('super_admin');

        $this->actingAs($admin)->postJson('/api/v1/admin/sliders', [
            'title' => 'Unsafe link',
            'image' => UploadedFile::fake()->image('unsafe.png'),
            'link_url' => 'javascript:alert(1)',
            'is_active' => true,
        ])->assertUnprocessable()->assertJsonValidationErrors(['link_url']);

        $first = $this->slider('First', true, 0);
        $second = $this->slider('Second', false, 1);
        $this->patchJson('/api/v1/admin/sliders/order', ['ids' => [(string) $first->id]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['ids']);
        $this->assertDatabaseHas('sliders', ['id' => $second->id, 'sort_order' => 1]);
    }

    private function slider(string $title, bool $active, int $sortOrder): Slider
    {
        return Slider::query()->create([
            'title' => $title,
            'image_path' => "sliders/{$title}.png",
            'is_active' => $active,
            'sort_order' => $sortOrder,
        ]);
    }

    private function user(string $role): User
    {
        return User::query()->create([
            'name' => ucfirst($role),
            'email' => $role.'-'.uniqid().'@example.test',
            'password' => Hash::make('long-test-password'),
            'role' => $role,
            'status' => 'active',
        ]);
    }
}
