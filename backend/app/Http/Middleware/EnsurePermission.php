<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePermission
{
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        $user = $request->user();
        $isActive = $user && $user->status === 'active';
        $permissions = config('permissions.roles.'.$user?->role, []);

        abort_unless(
            $isActive && (in_array('*', $permissions, true) || in_array($permission, $permissions, true)),
            403,
            'Bu işlem için yetkiniz yok.',
        );

        return $next($request);
    }
}
