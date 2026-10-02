<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('app:user:create {--name=} {--email=} {--role=} {--phone=}')]
#[Description('Create a real portal user without seeding demo accounts.')]
class CreatePortalUser extends Command
{
    public function handle(): int
    {
        $name = $this->option('name') ?: $this->ask('Full name');
        $email = $this->option('email') ?: $this->ask('Email');
        $role = $this->option('role') ?: $this->choice(
            'Role',
            ['super_admin', 'shop_owner', 'sponsor', 'staff', 'customer'],
        );
        $phone = $this->option('phone') ?: null;
        $password = $this->secret('Password (minimum 12 characters)');

        if (! in_array($role, ['super_admin', 'shop_owner', 'sponsor', 'staff', 'customer'], true)) {
            $this->error('Unsupported role.');

            return self::FAILURE;
        }

        if (strlen((string) $password) < 12) {
            $this->error('Password must contain at least 12 characters.');

            return self::FAILURE;
        }

        if (User::query()->where('email', $email)->exists()) {
            $this->error('A user with this email already exists.');

            return self::FAILURE;
        }

        User::query()->create([
            'name' => $name,
            'email' => $email,
            'password' => $password,
            'role' => $role,
            'status' => 'active',
            'phone' => $phone,
        ]);

        $this->info("Created {$role} account for {$email}.");

        return self::SUCCESS;
    }
}
