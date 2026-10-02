<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\LocationCatalog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request, LocationCatalog $locations): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'phone' => ['required', 'string', 'max:40'],
            ...$this->customerLocationRules($request, $locations),
            'password' => ['required', 'string', 'min:12', 'confirmed'],
        ]);

        $user = User::query()->create([
            'name' => $data['name'],
            'email' => mb_strtolower($data['email']),
            'phone' => $data['phone'] ?? null,
            'city' => $data['city'],
            'district' => $data['district'],
            'password' => Hash::make($data['password']),
            'role' => 'customer',
            'status' => 'active',
        ]);

        Auth::guard('web')->login($user);
        $request->session()->regenerate();
        $user->forceFill(['last_login_at' => now()])->save();

        return response()->json($this->present($user), 201);
    }

    public function registerCustomer(Request $request, LocationCatalog $locations): JsonResponse
    {
        $data = $request->validate([
            'fullName' => ['required', 'string', 'min:2', 'max:120'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:12'],
            'phone' => ['required', 'string', 'max:40'],
            ...$this->customerLocationRules($request, $locations),
        ]);

        $user = User::query()->create([
            'name' => trim($data['fullName']),
            'email' => mb_strtolower($data['email']),
            'phone' => $data['phone'] ?: null,
            'city' => $data['city'],
            'district' => $data['district'],
            'password' => Hash::make($data['password']),
            'role' => 'customer',
            'status' => 'active',
        ]);

        return response()->json($this->present($user), 201);
    }

    public function registerShop(Request $request, LocationCatalog $locations): JsonResponse
    {
        $data = $request->validate([
            'fullName' => ['required', 'string', 'min:2', 'max:120'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:12'],
            'shopName' => ['required', 'string', 'min:2', 'max:120'],
            'phone' => ['required', 'string', 'max:40'],
            ...$this->customerLocationRules($request, $locations),
        ]);

        $owner = $this->createShopOwner([
            'name' => trim($data['fullName']),
            'email' => mb_strtolower($data['email']),
            'password' => $data['password'],
            'shopName' => trim($data['shopName']),
            'phone' => trim($data['phone']),
            'shopPhone' => trim($data['phone']),
            'city' => trim($data['city']),
            'district' => trim($data['district']),
            'address' => '',
        ]);

        return response()->json([
            'message' => 'Başvurunuz alındı. Yönetim onayından sonra panelinize erişebilirsiniz.',
            'user' => $this->present($owner),
        ], 201);
    }

    public function registerShopOwner(Request $request, LocationCatalog $locations): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'phone' => ['required', 'string', 'max:40'],
            'password' => ['required', 'string', 'min:12', 'confirmed'],
            'shopName' => ['required', 'string', 'min:2', 'max:120'],
            ...$this->customerLocationRules($request, $locations),
            'address' => ['required', 'string', 'max:255'],
            'shopPhone' => ['required', 'string', 'max:40'],
        ]);

        $owner = $this->createShopOwner($data);

        return response()->json([
            'message' => 'Başvurunuz alındı. Süper Admin onayından sonra panelinize erişebilirsiniz.',
            'user' => $this->present($owner),
        ], 201);
    }

    /**
     * @param array{name:string,email:string,phone:string,password:string,shopName:string,city:string,district:string,address:string,shopPhone:string} $data
     */
    private function createShopOwner(array $data): User
    {
        return DB::transaction(function () use ($data): User {
            $user = User::query()->create([
                'name' => $data['name'],
                'email' => mb_strtolower($data['email']),
                'phone' => $data['phone'],
                'city' => $data['city'],
                'district' => $data['district'],
                'password' => Hash::make($data['password']),
                'role' => 'shop_owner',
                'status' => 'pending_approval',
            ]);

            $user->shops()->create([
                'name' => $data['shopName'],
                'slug' => Str::slug($data['shopName']).'-'.Str::lower(Str::random(8)),
                'description' => '',
                'status' => 'pending_approval',
                'is_approved' => false,
                'city' => $data['city'],
                'district' => $data['district'],
                'street' => $data['address'],
                'phone' => $data['shopPhone'],
            ]);

            return $user;
        });
    }

    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);
        $user = User::query()->where('email', mb_strtolower($credentials['email']))->first();
        $canSignIn = $user && Hash::check($credentials['password'], $user->password)
            && ($user->status === 'active'
                || ($user->role === 'shop_owner' && in_array($user->status, ['pending_approval', 'approved'], true)));

        if (! $canSignIn) {
            throw ValidationException::withMessages([
                'email' => ['E-posta veya parola hatalı.'],
            ]);
        }

        Auth::guard('web')->login($user);
        $request->session()->regenerate();
        $user->forceFill(['last_login_at' => now()])->save();

        return response()->json($this->present($user));
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        Auth::forgetGuards();

        return response()->json(['message' => 'Oturum kapatıldı.']);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless(
            $user->status === 'active'
                || ($user->role === 'shop_owner' && in_array($user->status, ['pending_approval', 'approved'], true)),
            403,
            'Hesap askıya alınmış.',
        );

        return response()->json($this->present($user));
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $data = $request->validate([
            'fullName' => ['required', 'string', 'min:2', 'max:120'],
            'phone' => ['nullable', 'string', 'max:40'],
            'avatar' => ['nullable', 'image', 'max:3072'],
        ]);

        $user = $request->user();
        $previousAvatar = $user->avatar_url;
        $attributes = [
            'name' => trim($data['fullName']),
            'phone' => isset($data['phone']) && trim($data['phone']) !== '' ? trim($data['phone']) : null,
        ];

        if ($request->hasFile('avatar')) {
            $path = $request->file('avatar')->storePublicly('avatars', 'public');
            if (! $path) {
                abort(500, 'Profil fotoğrafı kaydedilemedi.');
            }
            $attributes['avatar_url'] = Storage::disk('public')->url($path);
        }

        $user->update($attributes);

        if ($request->hasFile('avatar') && $previousAvatar && str_starts_with($previousAvatar, Storage::disk('public')->url('avatars/'))) {
            $previousPath = ltrim(substr($previousAvatar, strlen(Storage::disk('public')->url(''))), '/');
            if ($previousPath !== '' && Storage::disk('public')->exists($previousPath) && ! Storage::disk('public')->delete($previousPath)) {
                abort(500, 'Eski profil fotoğrafı silinemedi.');
            }
        }

        return response()->json($this->present($user->refresh()));
    }

    private function present(User $user): array
    {
        $shop = $user->role === 'shop_owner'
            ? $user->shops()->select(['id', 'name'])->first()
            : null;

        return [
            'id' => (string) $user->id,
            'fullName' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'city' => $user->city,
            'district' => $user->district,
            'role' => $user->role,
            'status' => $user->status,
            'avatarUrl' => $user->avatar_url,
            'shopId' => $shop ? (string) $shop->id : null,
            'shopName' => $shop?->name,
            'hasContactConsent' => $user->has_contact_consent,
            'createdAt' => $user->created_at?->toISOString(),
            'lastLoginAt' => $user->last_login_at?->toISOString(),
        ];
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    private function customerLocationRules(Request $request, LocationCatalog $locations): array
    {
        $city = $request->input('city');

        return [
            'city' => ['required', 'string', 'max:120', Rule::in($locations->cities())],
            'district' => [
                'required',
                'string',
                'max:120',
                Rule::in(is_string($city) ? $locations->districts($city) : []),
            ],
        ];
    }
}
