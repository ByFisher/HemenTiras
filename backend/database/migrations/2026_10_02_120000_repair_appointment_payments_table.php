<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('appointment_payments')) {
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

            return;
        }

        $addPaymentIntentId = ! Schema::hasColumn('appointment_payments', 'payment_intent_id');
        $addCheckoutUrl = ! Schema::hasColumn('appointment_payments', 'checkout_url');
        $addTransactionId = ! Schema::hasColumn('appointment_payments', 'transaction_id');
        $addPaymentMethod = ! Schema::hasColumn('appointment_payments', 'payment_method');
        if ($addPaymentIntentId || $addCheckoutUrl || $addTransactionId || $addPaymentMethod) {
            Schema::table('appointment_payments', function (Blueprint $table) use ($addPaymentIntentId, $addCheckoutUrl, $addTransactionId, $addPaymentMethod): void {
                if ($addPaymentIntentId) {
                    $table->string('payment_intent_id')->nullable()->unique();
                }
                if ($addCheckoutUrl) {
                    $table->text('checkout_url')->nullable();
                }
                if ($addTransactionId) {
                    $table->string('transaction_id')->nullable()->unique();
                }
                if ($addPaymentMethod) {
                    $table->string('payment_method', 32)->nullable();
                }
            });
        }
    }

    public function down(): void
    {
        // Keep payment records intact if this repair migration is rolled back.
    }
};
