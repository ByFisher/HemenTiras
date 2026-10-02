<?php

use App\Http\Controllers\Api\AccessLogController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AdminPaymentController;
use App\Http\Controllers\Api\AdminReviewController;
use App\Http\Controllers\Api\AdminStaffController;
use App\Http\Controllers\Api\AppointmentController;
use App\Http\Controllers\Api\AppointmentPaymentController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ContentApprovalController;
use App\Http\Controllers\Api\CouponController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\FavoriteController;
use App\Http\Controllers\Api\FinanceController;
use App\Http\Controllers\Api\PrivacyConsentController;
use App\Http\Controllers\Api\PublicShopController;
use App\Http\Controllers\Api\ShopAppointmentController;
use App\Http\Controllers\Api\ShopController;
use App\Http\Controllers\Api\SliderController;
use App\Http\Controllers\Api\SponsorApprovalController;
use App\Models\Coupon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:5,1');
    Route::post('/auth/register', [AuthController::class, 'register'])->middleware('throttle:3,1');
    Route::post('/auth/register-customer', [AuthController::class, 'registerCustomer'])->middleware('throttle:3,1');
    Route::post('/auth/register-shop', [AuthController::class, 'registerShop'])->middleware('throttle:3,1');
    Route::post('/auth/register-shop-owner', [AuthController::class, 'registerShopOwner'])->middleware('throttle:3,1');
    Route::post('/privacy/consents', [PrivacyConsentController::class, 'store'])->middleware('throttle:10,1');
    Route::get('/locations/cities', [PublicShopController::class, 'cities']);
    Route::get('/locations/districts', [PublicShopController::class, 'districts']);
    Route::get('/shops/meta/cities', [PublicShopController::class, 'cities']);
    Route::get('/shops/meta/services', [PublicShopController::class, 'distinctServices']);
    Route::get('/sliders', [SliderController::class, 'publicIndex']);
    Route::get('/shops', [PublicShopController::class, 'index']);
    Route::get('/shops/slug/{slug}', [PublicShopController::class, 'showBySlug']);
    Route::get('/shops/{shop}', [PublicShopController::class, 'show']);
    Route::get('/shops/{shop}/services', [PublicShopController::class, 'services']);
    Route::get('/shops/{shop}/staff', [PublicShopController::class, 'staff']);
    Route::get('/shops/{shop}/staff/{staff}', [PublicShopController::class, 'staffDetail']);
    Route::get('/shops/{shop}/staff/{staff}/reviews', [PublicShopController::class, 'reviews']);
    Route::get('/shops/{shop}/staff/{staff}/availability', [PublicShopController::class, 'availability']);
    Route::post('/payments/iyzico/callback', [AppointmentPaymentController::class, 'iyzicoCallback'])
        ->middleware('throttle:60,1')
        ->name('api.v1.payments.iyzico.callback');
    Route::middleware('auth:sanctum')->group(function (): void {
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);
        Route::put('/user/profile', [AuthController::class, 'updateProfile']);

        Route::prefix('admin')->group(function (): void {
            Route::middleware('permission:admin.sliders.manage')->group(function (): void {
                Route::get('/sliders', [SliderController::class, 'adminIndex']);
                Route::post('/sliders', [SliderController::class, 'store']);
                Route::patch('/sliders/order', [SliderController::class, 'reorder']);
                Route::patch('/sliders/{slider}', [SliderController::class, 'update']);
                Route::delete('/sliders/{slider}', [SliderController::class, 'destroy']);
            });

            Route::middleware('permission:admin.users.view')->group(function (): void {
                Route::get('/directory', [AdminController::class, 'directory']);
                Route::get('/users', [AdminController::class, 'users']);
                Route::get('/recent-users', [AdminController::class, 'recentUsers']);
            });

            Route::middleware('permission:admin.users.manage')->group(function (): void {
                Route::patch('/users/{user}/status', [AdminController::class, 'setUserStatus']);
            });

            Route::middleware('permission:admin.staff.manage')->group(function (): void {
                Route::get('/staff', [AdminStaffController::class, 'index']);
                Route::post('/staff', [AdminStaffController::class, 'store']);
                Route::patch('/staff/{user}/role', [AdminStaffController::class, 'updateRole']);
            });

            Route::middleware('permission:admin.access_logs.view')->group(function (): void {
                Route::get('/access-logs', [AccessLogController::class, 'index']);
                Route::get('/access-logs/export', [AccessLogController::class, 'export']);
            });

            Route::middleware('permission:admin.payments.refund')->post(
                '/payments/{payment}/retry-refund',
                [AdminPaymentController::class, 'retryRefund'],
            );

            Route::middleware('role:super_admin')->group(function (): void {
                Route::get('/financial-logs', [FinanceController::class, 'adminIndex']);
                Route::get('/coupons', [CouponController::class, 'adminIndex']);
                Route::post('/coupons', [CouponController::class, 'adminStore']);
                Route::post('/coupons/{coupon}/approve', fn (Request $request, Coupon $coupon, CouponController $controller) => $controller->decide($request, $coupon, 'approve'));
                Route::post('/coupons/{coupon}/reject', fn (Request $request, Coupon $coupon, CouponController $controller) => $controller->decide($request, $coupon, 'reject'));
            });

            Route::middleware('permission:admin.shops.manage')->group(function (): void {
                Route::get('/shops', [AdminController::class, 'shops']);
                Route::get('/pending-approvals', [AdminController::class, 'pendingApprovals']);
                Route::patch('/shops/{shop}/status', [AdminController::class, 'setShopStatus']);
            });

            Route::middleware('permission:admin.sponsors.manage')->group(function (): void {
                Route::get('/sponsors', [AdminController::class, 'sponsors']);
                Route::get('/sponsor-approval-requests', [SponsorApprovalController::class, 'index']);
                Route::post('/sponsor-approval-requests/{requestModel}/approve', [SponsorApprovalController::class, 'approve']);
                Route::post('/sponsor-approval-requests/{requestModel}/reject', [SponsorApprovalController::class, 'reject']);
            });

            Route::middleware('permission:admin.content.moderate')->group(function (): void {
                Route::get('/reviews', [AdminReviewController::class, 'index']);
                Route::patch('/reviews/{review}/approve', [AdminReviewController::class, 'approve']);
                Route::delete('/reviews/{review}', [AdminReviewController::class, 'destroy']);
                Route::get('/approvals', [ContentApprovalController::class, 'index']);
                Route::patch('/approvals/{submission}/approve', [ContentApprovalController::class, 'approve']);
                Route::patch('/approvals/{submission}/reject', [ContentApprovalController::class, 'reject']);
                Route::get('/content-approval-queue', [ContentApprovalController::class, 'index']);
                Route::post('/content-approval-queue/{submission}/approved', [ContentApprovalController::class, 'approve']);
                Route::post('/content-approval-queue/{submission}/rejected', [ContentApprovalController::class, 'reject']);
            });

            Route::middleware('permission:admin.support.manage')->group(function (): void {
                Route::get('/support-requests', [SponsorApprovalController::class, 'supportIndex']);
                Route::post('/support-requests/{requestModel}/approve', [SponsorApprovalController::class, 'approveSupport']);
                Route::post('/support-requests/{requestModel}/reject', [SponsorApprovalController::class, 'rejectSupport']);
            });
        });

        Route::middleware('role:shop_owner')->prefix('shop')->group(function (): void {
            Route::get('/financial-logs', [FinanceController::class, 'shopIndex']);
            Route::get('/coupons', [CouponController::class, 'shopIndex']);
            Route::post('/coupons', [CouponController::class, 'shopStore']);
            Route::get('/appointments', [ShopAppointmentController::class, 'index']);
            Route::post('/appointments/{appointment}/cancel', [ShopAppointmentController::class, 'cancel']);
            Route::get('/profile', [ShopController::class, 'profile']);
            Route::get('/hours', [ShopController::class, 'hours']);
            Route::put('/hours', [ShopController::class, 'updateHours']);
            Route::get('/gallery', [ShopController::class, 'gallery']);
            Route::get('/reviews', [ShopController::class, 'reviews']);
            Route::get('/customers', [CustomerController::class, 'index']);
            Route::post('/customers/{customer}/contact', [CustomerController::class, 'contact']);
            Route::get('/services', [ShopController::class, 'services']);
            Route::post('/services', [ShopController::class, 'createService']);
            Route::patch('/services/{service}', [ShopController::class, 'updateService']);
            Route::get('/staff', [ShopController::class, 'staff']);
            Route::post('/staff', [ShopController::class, 'createStaff']);
            Route::put('/staff/{staff}', [ShopController::class, 'updateStaff']);
            Route::get('/content-submissions', [ShopController::class, 'submissions']);
            Route::post('/content-submissions', [ShopController::class, 'submitContent']);
        });

        Route::middleware('role:sponsor')->post('/sponsor/approval-requests', [SponsorApprovalController::class, 'create']);
        Route::middleware('role:customer')->group(function (): void {
            Route::post('/coupons/validate', [CouponController::class, 'validateCode']);
            Route::get('/user/active-appointments', [AppointmentController::class, 'active']);
            Route::get('/appointments', [AppointmentController::class, 'index']);
            Route::post('/appointments', [AppointmentController::class, 'create']);
            Route::get('/appointments/{appointment}', [AppointmentController::class, 'show']);
            Route::post('/appointments/{appointment}/cancel', [AppointmentController::class, 'cancel']);
            Route::post('/appointments/{appointment}/demo-pay', [AppointmentController::class, 'demoPayment']);
            Route::post('/appointments/{appointment}/checkout', [AppointmentPaymentController::class, 'startCheckout']);
            Route::post('/appointments/{appointment}/checkout/verify', [AppointmentPaymentController::class, 'verifyCustomerCheckout']);
            Route::post('/appointments/{appointment}/review', [AppointmentController::class, 'review']);
            Route::get('/user/favorites', [FavoriteController::class, 'index']);
            Route::put('/user/favorites/{shop}', [FavoriteController::class, 'store']);
            Route::delete('/user/favorites/{shop}', [FavoriteController::class, 'destroy']);
        });
    });

    Route::get('/content-submissions/{submission}/preview', [ContentApprovalController::class, 'preview']);
});
