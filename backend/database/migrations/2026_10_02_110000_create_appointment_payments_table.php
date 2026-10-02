<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('appointments', function (Blueprint $table): void {
            $table->text('cancellation_reason')->nullable();
            $table->foreignId('cancelled_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('cancelled_at')->nullable();
        });

        Schema::create('appointment_payments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('appointment_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('provider', 32);
            $table->string('payment_intent_id')->nullable()->unique();
            $table->text('checkout_url')->nullable();
            $table->string('provider_payment_id')->nullable()->unique();
            $table->string('transaction_id')->nullable()->unique();
            $table->string('payment_method', 32)->nullable();
            $table->string('provider_refund_id')->nullable()->unique();
            $table->unsignedInteger('amount');
            $table->char('currency', 3)->default('TRY');
            $table->string('status', 32)->default('pending')->index();
            $table->uuid('refund_idempotency_key')->nullable()->unique();
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('refunded_at')->nullable();
            $table->string('failure_code', 80)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('appointment_payments');

        Schema::table('appointments', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('cancelled_by_user_id');
            $table->dropColumn(['cancellation_reason', 'cancelled_at']);
        });
    }
};
