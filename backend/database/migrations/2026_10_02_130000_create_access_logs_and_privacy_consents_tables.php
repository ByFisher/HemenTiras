<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('privacy_consents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->uuid('anonymous_visitor_id')->nullable()->index();
            $table->string('privacy_notice_version', 64);
            $table->timestamp('notice_acknowledged_at');
            $table->string('explicit_consent_purpose', 100)->nullable();
            $table->string('explicit_consent_version', 64)->nullable();
            $table->boolean('explicit_consent_granted')->nullable();
            $table->timestamp('explicit_consent_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'id']);
            $table->index(['anonymous_visitor_id', 'id']);
        });

        Schema::create('access_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->uuid('anonymous_visitor_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable()->index();
            $table->unsignedSmallInteger('client_port')->nullable();
            $table->timestamp('occurred_at_utc')->index();
            $table->string('occurred_at_local', 40);
            $table->text('user_agent')->nullable();
            $table->string('device_type', 16)->default('unknown')->index();
            $table->string('http_method', 10);
            $table->string('request_path', 2048);
            $table->unsignedSmallInteger('response_status');
            $table->string('privacy_notice_version', 64)->nullable();
            $table->timestamp('notice_acknowledged_at')->nullable();
            $table->string('explicit_consent_purpose', 100)->nullable();
            $table->string('explicit_consent_version', 64)->nullable();
            $table->boolean('explicit_consent_granted')->nullable();
            $table->timestamp('explicit_consent_at')->nullable();
            $table->index(['user_id', 'occurred_at_utc']);
            $table->index(['http_method', 'occurred_at_utc']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('access_logs');
        Schema::dropIfExists('privacy_consents');
    }
};
