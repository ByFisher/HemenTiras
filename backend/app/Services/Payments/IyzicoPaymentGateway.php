<?php

namespace App\Services\Payments;

use App\Contracts\HostedCheckoutGateway;
use App\Contracts\PaymentGateway;
use App\Exceptions\PaymentGatewayException;
use App\Models\AppointmentPayment;
use App\Models\User;
use Iyzipay\Model\Address;
use Iyzipay\Model\BasketItem;
use Iyzipay\Model\BasketItemType;
use Iyzipay\Model\Buyer;
use Iyzipay\Model\CheckoutForm;
use Iyzipay\Model\CheckoutFormInitialize;
use Iyzipay\Model\Currency;
use Iyzipay\Model\Locale;
use Iyzipay\Model\PaymentGroup;
use Iyzipay\Model\Refund;
use Iyzipay\Options;
use Iyzipay\Request\CreateCheckoutFormInitializeRequest;
use Iyzipay\Request\CreateRefundRequest;
use Iyzipay\Request\RetrieveCheckoutFormRequest;

class IyzicoPaymentGateway implements HostedCheckoutGateway, PaymentGateway
{
    public function capture(AppointmentPayment $payment): string
    {
        if ($payment->status === 'paid' && $payment->transaction_id) {
            return $payment->transaction_id;
        }

        throw new PaymentGatewayException('iyzico payments must be completed through Checkout Form.');
    }

    public function refund(AppointmentPayment $payment): string
    {
        if ($payment->provider !== 'iyzico' || ! $payment->transaction_id || ! $payment->refund_idempotency_key) {
            throw new PaymentGatewayException('The iyzico refund is missing its transaction or idempotency reference.');
        }

        $ip = request()->ip();
        if (! $ip || filter_var($ip, FILTER_VALIDATE_IP) === false) {
            throw new PaymentGatewayException('A valid request IP is required for the iyzico refund.');
        }

        $request = new CreateRefundRequest;
        $request->setLocale(Locale::TR);
        $request->setConversationId($payment->refund_idempotency_key);
        $request->setPaymentTransactionId($payment->transaction_id);
        $request->setPrice($this->formatAmount($payment->amount));
        $request->setCurrency($payment->currency);
        $request->setIp($ip);

        $refund = Refund::create($request, $this->options());
        if ($refund->getStatus() !== 'success' || ! $refund->getConversationId()) {
            throw new PaymentGatewayException('iyzico could not complete the refund.');
        }

        return $refund->getConversationId();
    }

    public function initializeCheckout(
        AppointmentPayment $payment,
        User $customer,
        array $buyerDetails,
        string $ip,
        string $callbackUrl,
    ): array {
        $appointment = $payment->loadMissing(['appointment.service', 'appointment.services'])->appointment;
        $serviceNames = $appointment?->services
            ->pluck('pivot.service_name')
            ->filter()
            ->values();
        if ($serviceNames?->isEmpty() && $appointment?->service) {
            $serviceNames = collect([$appointment->service->name]);
        }
        if (
            ! $appointment
            || $serviceNames?->isEmpty()
            || filter_var($ip, FILTER_VALIDATE_IP) === false
            || parse_url($callbackUrl, PHP_URL_SCHEME) !== 'https'
        ) {
            throw new PaymentGatewayException('The appointment is missing required checkout details.');
        }

        $price = $this->formatAmount($payment->amount);
        $request = new CreateCheckoutFormInitializeRequest;
        $request->setLocale(Locale::TR);
        $request->setConversationId((string) $payment->id);
        $request->setPrice($price);
        $request->setPaidPrice($price);
        $request->setCurrency(Currency::TL);
        $request->setBasketId($this->basketId($payment));
        $request->setPaymentGroup(PaymentGroup::PRODUCT);
        $request->setCallbackUrl($callbackUrl);
        $request->setBuyer($this->buyer($customer, $buyerDetails, $ip));
        $address = $this->address($customer, $buyerDetails['registrationAddress']);
        $request->setBillingAddress($address);
        $request->setShippingAddress($address);

        $item = new BasketItem;
        $item->setId('appointment-'.$appointment->id);
        $item->setName(mb_substr($serviceNames->implode(', '), 0, 100));
        $item->setCategory1('Randevu hizmeti');
        $item->setItemType(BasketItemType::VIRTUAL);
        $item->setPrice($price);
        $request->setBasketItems([$item]);

        $response = CheckoutFormInitialize::create($request, $this->options());
        $token = $response->getToken();
        $checkoutUrl = $response->getPaymentPageUrl();
        if (
            $response->getStatus() !== 'success'
            || ! is_string($token)
            || $token === ''
            || ! is_string($checkoutUrl)
            || ! filter_var($checkoutUrl, FILTER_VALIDATE_URL)
            || parse_url($checkoutUrl, PHP_URL_SCHEME) !== 'https'
            || ! $this->signatureMatches(
                $response->getSignature(),
                [(string) $payment->id, $token],
            )
        ) {
            throw new PaymentGatewayException('iyzico could not initialize a verified Checkout Form.');
        }

        return ['token' => $token, 'checkoutUrl' => $checkoutUrl];
    }

    public function retrieveCheckout(AppointmentPayment $payment, string $token): array
    {
        if (! $payment->payment_intent_id || ! hash_equals($payment->payment_intent_id, $token)) {
            throw new PaymentGatewayException('The iyzico checkout token does not match the payment.');
        }

        $request = new RetrieveCheckoutFormRequest;
        $request->setLocale(Locale::TR);
        $request->setConversationId((string) $payment->id);
        $request->setToken($token);

        $checkout = CheckoutForm::retrieve($request, $this->options());
        $signatureParts = [
            (string) $checkout->getPaymentStatus(),
            (string) $checkout->getPaymentId(),
            (string) $checkout->getCurrency(),
            (string) $checkout->getBasketId(),
            (string) $checkout->getConversationId(),
            (string) $checkout->getPaidPrice(),
            (string) $checkout->getPrice(),
            (string) $checkout->getToken(),
        ];

        if (
            $checkout->getStatus() !== 'success'
            || ! $this->signatureMatches($checkout->getSignature(), $signatureParts)
            || $checkout->getConversationId() !== (string) $payment->id
            || $checkout->getBasketId() !== $this->basketId($payment)
            || $checkout->getCurrency() !== Currency::TL
            || $this->amountInMinorUnits($checkout->getPrice()) !== $payment->amount * 100
        ) {
            throw new PaymentGatewayException('iyzico checkout verification failed.');
        }

        if ($checkout->getPaymentStatus() !== 'SUCCESS') {
            return ['status' => 'failure'];
        }

        $items = $checkout->getPaymentItems();
        if (! is_array($items) || count($items) !== 1) {
            throw new PaymentGatewayException('iyzico checkout returned an invalid transaction list.');
        }

        $transactionId = $items[0]->getPaymentTransactionId();
        $paymentId = $checkout->getPaymentId();
        if (! $transactionId || ! $paymentId) {
            throw new PaymentGatewayException('iyzico checkout did not return a payment transaction reference.');
        }

        return [
            'status' => 'success',
            'paymentId' => (string) $paymentId,
            'transactionId' => (string) $transactionId,
            'currency' => (string) $checkout->getCurrency(),
            'price' => (string) $checkout->getPrice(),
        ];
    }

    private function buyer(User $customer, array $details, string $ip): Buyer
    {
        $parts = preg_split('/\s+/', trim($customer->name), 2) ?: [];
        $buyer = new Buyer;
        $buyer->setId('customer-'.$customer->id);
        $buyer->setName($parts[0] ?? $customer->name);
        $buyer->setSurname($parts[1] ?? ($parts[0] ?? $customer->name));
        $buyer->setIdentityNumber($details['identityNumber']);
        $buyer->setEmail($customer->email);
        $buyer->setGsmNumber($this->normalizePhone($customer->phone));
        $buyer->setRegistrationDate($customer->created_at->format('Y-m-d H:i:s'));
        $buyer->setLastLoginDate($customer->last_login_at?->format('Y-m-d H:i:s') ?? now()->format('Y-m-d H:i:s'));
        $buyer->setRegistrationAddress($details['registrationAddress']);
        $buyer->setCity($customer->city);
        $buyer->setCountry('Turkey');
        $buyer->setIp($ip);

        return $buyer;
    }

    private function address(User $customer, string $registrationAddress): Address
    {
        $address = new Address;
        $address->setContactName($customer->name);
        $address->setCity($customer->city);
        $address->setCountry('Turkey');
        $address->setAddress($registrationAddress);

        return $address;
    }

    private function options(): Options
    {
        $apiKey = config('payments.iyzico.api_key');
        $secretKey = config('payments.iyzico.secret_key');
        $baseUrl = config('payments.iyzico.base_url');

        if (! is_string($apiKey) || trim($apiKey) === '' || ! is_string($secretKey) || trim($secretKey) === ''
            || ! is_string($baseUrl) || parse_url($baseUrl, PHP_URL_SCHEME) !== 'https') {
            throw new PaymentGatewayException('iyzico credentials or secure API URL are not configured.');
        }

        $options = new Options;
        $options->setApiKey($apiKey);
        $options->setSecretKey($secretKey);
        $options->setBaseUrl(rtrim($baseUrl, '/'));

        return $options;
    }

    /**
     * @param  array<int, string>  $parts
     */
    private function signatureMatches(?string $signature, array $parts): bool
    {
        $secretKey = config('payments.iyzico.secret_key');
        if (! is_string($signature) || ! is_string($secretKey) || $secretKey === '') {
            return false;
        }

        return hash_equals(hash_hmac('sha256', implode(':', $parts), $secretKey), $signature);
    }

    private function basketId(AppointmentPayment $payment): string
    {
        return 'appointment-payment-'.$payment->id;
    }

    private function formatAmount(int $amount): string
    {
        return number_format($amount, 2, '.', '');
    }

    private function amountInMinorUnits(mixed $amount): ?int
    {
        if (! is_string($amount) && ! is_int($amount) && ! is_float($amount)) {
            return null;
        }

        $value = (string) $amount;
        if (! preg_match('/^\d+(?:\.\d+)?$/', $value)) {
            return null;
        }

        [$whole, $fraction] = array_pad(explode('.', $value, 2), 2, '');
        $fraction = rtrim($fraction, '0');
        if (strlen($fraction) > 2) {
            return null;
        }

        return ((int) $whole * 100) + (int) str_pad($fraction, 2, '0');
    }

    private function normalizePhone(?string $phone): string
    {
        if (! $phone) {
            throw new PaymentGatewayException('A customer phone number is required for iyzico Checkout Form.');
        }

        $phone = trim($phone);
        $international = str_starts_with($phone, '+');
        $digits = preg_replace('/\D+/', '', $phone);
        if (! is_string($digits) || $digits === '') {
            throw new PaymentGatewayException('A valid customer phone number is required for iyzico Checkout Form.');
        }

        if ($international) {
            return '+'.$digits;
        }
        if (str_starts_with($digits, '0')) {
            return '+90'.substr($digits, 1);
        }

        return '+'.(str_starts_with($digits, '90') ? $digits : '90'.$digits);
    }
}
