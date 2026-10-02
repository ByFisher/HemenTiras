<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();
        $isActive = $user && ($user->role === 'shop_owner'
            ? in_array($user->status, ['active', 'approved'], true)
                && $user->shops()->where('status', 'active')->exists()
            : $user->status === 'active');

        abort_unless(
            $isActive && in_array($user->role, $roles, true),
            403,
            'Bu işlem için yetkiniz yok.',
        );

        return $next($request);
    }
}
