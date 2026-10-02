<?php

return [
    'driver' => env('PAYMENT_DRIVER', 'demo'),
    'demo_enabled' => env(
        'PAYMENT_DEMO_ENABLED',
        in_array(env('APP_ENV', 'production'), ['local', 'testing'], true),
    ),
    'frontend_url' => env('FRONTEND_URL', 'http://localhost:3000'),
    'iyzico' => [
        'api_key' => env('IYZICO_API_KEY'),
        'secret_key' => env('IYZICO_SECRET_KEY'),
        'base_url' => env('IYZICO_BASE_URL', 'https://sandbox-api.iyzipay.com'),
        'callback_url' => env('IYZICO_CALLBACK_URL'),
    ],
];
