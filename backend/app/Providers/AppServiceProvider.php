<?php

namespace App\Providers;

use App\Contracts\PaymentGateway;
use App\Services\Payments\DemoPaymentGateway;
use App\Services\Payments\IyzicoPaymentGateway;
use Illuminate\Support\ServiceProvider;
use InvalidArgumentException;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(PaymentGateway::class, function (): PaymentGateway {
            return match (config('payments.driver')) {
                'demo' => $this->app->make(DemoPaymentGateway::class),
                'iyzico' => $this->app->make(IyzicoPaymentGateway::class),
                default => throw new InvalidArgumentException('Configured payment gateway is not supported.'),
            };
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
