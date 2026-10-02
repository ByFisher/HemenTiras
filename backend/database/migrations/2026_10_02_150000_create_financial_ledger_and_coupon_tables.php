<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('coupons', function (Blueprint $table): void {
            $table->id();
            $table->string('code', 64)->unique();
            $table->string('created_by_role', 24);
            $table->foreignId('created_by_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('shop_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('discount_type', 16);
            $table->decimal('discount_value', 10, 2);
            $table->unsignedInteger('max_discount_amount')->nullable();
            $table->unsignedInteger('min_basket_amount')->default(0);
            $table->unsignedInteger('usage_limit');
            $table->unsignedInteger('used_count')->default(0);
            $table->unsignedBigInteger('reserved_budget')->default(0);
            $table->string('status', 16)->default('pending')->index();
            $table->timestamp('expires_at')->index();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
            $table->index(['shop_id', 'status', 'expires_at']);
        });

        Schema::create('financial_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('shop_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type', 24);
            $table->decimal('amount', 12, 2);
            $table->string('description', 500);
            $table->string('source_type', 100)->nullable();
            $table->string('source_id', 64)->nullable();
            $table->timestamps();
            $table->index(['shop_id', 'created_at']);
            $table->index(['user_id', 'created_at']);
            $table->unique(['source_type', 'source_id', 'type']);
        });

        Schema::create('coupon_usages', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('coupon_id')->constrained()->restrictOnDelete();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->foreignId('appointment_id')->unique()->constrained()->restrictOnDelete();
            $table->unsignedInteger('discount_amount');
            $table->timestamp('created_at')->useCurrent();
            $table->index(['coupon_id', 'user_id']);
        });

        Schema::table('appointments', function (Blueprint $table): void {
            $table->unsignedInteger('base_price')->nullable();
            $table->unsignedInteger('discount_amount')->default(0);
            $table->foreignId('coupon_id')->nullable()->constrained()->nullOnDelete();
        });

        Schema::create('appointment_services', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('appointment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('service_id')->constrained('shop_services')->restrictOnDelete();
            $table->string('service_name');
            $table->unsignedInteger('duration_minutes');
            $table->unsignedInteger('price');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->unique(['appointment_id', 'service_id']);
        });

        Schema::table('appointment_payments', function (Blueprint $table): void {
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('shop_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedInteger('discount_amount')->default(0);
            $table->foreignId('coupon_id')->nullable()->constrained()->nullOnDelete();
            $table->string('payment_status', 32)->default('pending')->index();
        });

        DB::table('appointments')->whereNull('base_price')->update(['base_price' => DB::raw('total_price')]);
        DB::table('appointment_services')
            ->insertUsing(
                ['appointment_id', 'service_id', 'service_name', 'duration_minutes', 'price', 'sort_order', 'created_at', 'updated_at'],
                DB::table('appointments')
                    ->join('shop_services', 'appointments.service_id', '=', 'shop_services.id')
                    ->select(
                        'appointments.id',
                        'shop_services.id',
                        'shop_services.name',
                        'shop_services.duration_minutes',
                        'appointments.total_price',
                        DB::raw('0'),
                        'appointments.created_at',
                        'appointments.updated_at',
                    ),
            );
        DB::table('appointment_payments')->update(['payment_status' => DB::raw('status')]);
        DB::table('appointment_payments')
            ->update([
                'user_id' => DB::raw('(select customer_id from appointments where appointments.id = appointment_payments.appointment_id)'),
                'shop_id' => DB::raw('(select shop_id from appointments where appointments.id = appointment_payments.appointment_id)'),
            ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('appointment_services');
        Schema::table('appointment_payments', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('coupon_id');
            $table->dropConstrainedForeignId('shop_id');
            $table->dropConstrainedForeignId('user_id');
            $table->dropIndex(['payment_status']);
            $table->dropColumn(['payment_status', 'discount_amount']);
        });
        Schema::table('appointments', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('coupon_id');
            $table->dropColumn(['base_price', 'discount_amount']);
        });
        Schema::dropIfExists('coupon_usages');
        Schema::dropIfExists('financial_logs');
        Schema::dropIfExists('coupons');
    }
};
