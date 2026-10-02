<?php

namespace App\Console\Commands;

use App\Models\Shop;
use App\Models\User;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

#[Signature('app:shop:create {--owner=} {--name=} {--city=} {--district=} {--phone=}')]
#[Description('Create an empty shop record for an existing shop owner.')]
class CreateShop extends Command
{
    public function handle(): int
    {
        $email = $this->option('owner') ?: $this->ask('Shop owner email');
        $owner = User::query()->where('email', $email)->where('role', 'shop_owner')->first();
        if (! $owner) {
            $this->error('No shop-owner account exists for this email.');

            return self::FAILURE;
        }

        if ($owner->shops()->exists()) {
            $this->error('This account already has a shop.');

            return self::FAILURE;
        }

        $name = $this->option('name') ?: $this->ask('Shop name');
        $city = $this->option('city') ?: $this->ask('City');
        $district = $this->option('district') ?: $this->ask('District');
        $phone = $this->option('phone') ?: $this->ask('Shop phone');
        $slug = Str::slug($name);

        if ($slug === '' || Shop::query()->where('slug', $slug)->exists()) {
            $this->error('Shop name cannot produce a unique URL slug.');

            return self::FAILURE;
        }

        Shop::query()->create([
            'owner_user_id' => $owner->id,
            'name' => $name,
            'slug' => $slug,
            'city' => $city,
            'district' => $district,
            'phone' => $phone,
        ]);

        $this->info("Created shop '{$name}' in pending-approval status.");

        return self::SUCCESS;
    }
}
