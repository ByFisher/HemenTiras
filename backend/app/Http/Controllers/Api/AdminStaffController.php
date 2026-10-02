<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AdminStaffController extends Controller
{
    private const ROLES = ['super_admin', 'admin', 'moderator'];

    private const ASSIGNABLE_ROLES = ['super_admin', 'admin', 'moderator', 'shop_owner', 'staff', 'customer', 'sponsor'];

    public function index(): JsonResponse
    {
        $staff = User::query()
            ->whereIn('role', self::ROLES)
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'phone', 'role', 'status', 'created_at'])
            ->map(fn (User $user) => $this->present($user));

        return response()->json($staff);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'phone' => ['required', 'string', 'max:40'],
            'password' => ['required', 'string', 'min:12'],
            'role' => ['required', Rule::in(self::ROLES)],
        ]);

        $user = DB::transaction(function () use ($request, $data): User {
            $user = User::query()->create([
                ...$data,
                'email' => mb_strtolower($data['email']),
                'status' => 'active',
            ]);
            $this->audit($request, 'admin.staff_created', $user);

            return $user;
        });

        return response()->json($this->present($user), 201);
    }

    public function updateRole(Request $request, User $user): JsonResponse
    {
        $data = $request->validate(['role' => ['required', Rule::in(self::ASSIGNABLE_ROLES)]]);
        $updated = DB::transaction(function () use ($request, $user, $data): User {
            $user = User::query()->lockForUpdate()->findOrFail($user->id);
            if ($user->role === 'super_admin' && $data['role'] !== 'super_admin') {
                $activeSuperAdmins = User::query()
                    ->where('role', 'super_admin')
                    ->where('status', 'active')
                    ->lockForUpdate()
                    ->count();
                abort_if($user->status === 'active' && $activeSuperAdmins <= 1, 409, 'Son aktif Süper Admin yetkisi kaldırılamaz.');
            }
            $user->update($data);
            $this->audit($request, 'admin.staff_role_changed', $user);

            return $user->refresh();
        });

        return response()->json($this->present($updated));
    }

    private function present(User $user): array
    {
        return [
            'id' => (string) $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'role' => $user->role,
            'status' => $user->status,
            'createdAt' => $user->created_at?->toISOString(),
        ];
    }

    private function audit(Request $request, string $action, User $subject): void
    {
        DB::table('audit_logs')->insert([
            'actor_user_id' => $request->user()->id,
            'action' => $action,
            'subject_type' => User::class,
            'subject_id' => (string) $subject->id,
            'metadata' => json_encode(['role' => $subject->role], JSON_THROW_ON_ERROR),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
