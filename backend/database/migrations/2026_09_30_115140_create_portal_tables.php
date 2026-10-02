<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('shops', function (Blueprint $table) {
            $table->id();
            $table->foreignId('owner_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('slug')->unique();
            $table->string('name');
            $table->text('description')->default('');
            $table->string('status')->default('pending_approval')->index();
            $table->string('city');
            $table->string('district');
            $table->string('street')->default('');
            $table->string('phone')->nullable();
            $table->string('cover_image_url')->nullable();
            $table->string('profile_image_url')->nullable();
            $table->json('working_hours')->nullable();
            $table->decimal('commission_rate', 5, 2)->default(0);
            $table->timestamps();
        });

        Schema::create('shop_services', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('category')->default('');
            $table->text('description')->default('');
            $table->unsignedSmallInteger('duration_minutes');
            $table->unsignedInteger('price');
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('staff', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained()->cascadeOnDelete();
            $table->string('first_name');
            $table->string('last_name');
            $table->string('title');
            $table->unsignedTinyInteger('experience_years')->default(0);
            $table->text('biography')->default('');
            $table->string('photo_url')->nullable();
            $table->string('approval_status')->default('pending_approval')->index();
            $table->json('working_hours')->nullable();
            $table->json('skills')->nullable();
            $table->json('work_logs')->nullable();
            $table->decimal('owner_rating', 3, 2)->default(0);
            $table->timestamps();
        });

        Schema::create('appointments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('shop_id')->constrained()->cascadeOnDelete();
            $table->foreignId('staff_id')->constrained('staff')->cascadeOnDelete();
            $table->foreignId('service_id')->constrained('shop_services')->cascadeOnDelete();
            $table->dateTime('starts_at')->index();
            $table->dateTime('ends_at');
            $table->string('status')->default('pending')->index();
            $table->unsignedInteger('total_price');
            $table->text('note')->nullable();
            $table->timestamps();
            $table->index(['staff_id', 'starts_at', 'status']);
            $table->unique(['staff_id', 'starts_at', 'status']);
        });

        Schema::create('staff_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('appointment_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('staff_id')->constrained('staff')->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedTinyInteger('rating');
            $table->text('comment')->nullable();
            $table->timestamps();
        });

        Schema::create('shop_content_submissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained()->cascadeOnDelete();
            $table->foreignId('submitted_by')->constrained('users')->cascadeOnDelete();
            $table->foreignId('related_entity_id')->nullable()->constrained('staff')->nullOnDelete();
            $table->string('kind');
            $table->string('title');
            $table->text('description')->default('');
            $table->json('payload')->nullable();
            $table->string('preview_url')->nullable();
            $table->string('file_path')->nullable();
            $table->string('approval_status')->default('pending_approval')->index();
            $table->text('rejection_reason')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('sponsor_approval_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sponsor_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('kind');
            $table->string('title');
            $table->text('details');
            $table->string('status')->default('pending_approval')->index();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action');
            $table->string('subject_type');
            $table->string('subject_id')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('sponsor_approval_requests');
        Schema::dropIfExists('shop_content_submissions');
        Schema::dropIfExists('staff_reviews');
        Schema::dropIfExists('appointments');
        Schema::dropIfExists('staff');
        Schema::dropIfExists('shop_services');
        Schema::dropIfExists('shops');
    }
};
