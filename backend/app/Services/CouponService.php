<?php

namespace App\Services;

use App\Models\Appointment;
use App\Models\Coupon;
use App\Models\CouponUsage;
use App\Models\Shop;
use Illuminate\Validation\ValidationException;

class CouponService
{
    /**
     * @return array{coupon: Coupon, discount_amount: int, total_price: int}
     */
    public function quote(string $code, Shop $shop, int $basketAmount): array
    {
        $coupon = Coupon::query()->where('code', mb_strtoupper(trim($code)))->first();
        if (! $coupon || $coupon->shop_id !== null && $coupon->shop_id !== $shop->id) {
            $this->invalidCoupon();
        }
        $this->assertUsable($coupon, $basketAmount);

        return [
            'coupon' => $coupon,
            'discount_amount' => $this->discountAmount($coupon, $basketAmount),
            'total_price' => $basketAmount - $this->discountAmount($coupon, $basketAmount),
        ];
    }

    public function reserveForAppointment(
        Coupon $coupon,
        Shop $shop,
        int $basketAmount,
        Appointment $appointment,
        int $userId,
    ): int {
        $locked = Coupon::query()->whereKey($coupon->id)->lockForUpdate()->firstOrFail();
        if ($locked->shop_id !== null && $locked->shop_id !== $shop->id) {
            $this->invalidCoupon();
        }
        $this->assertUsable($locked, $basketAmount);
        $discount = $this->discountAmount($locked, $basketAmount);
        $locked->increment('used_count');
        CouponUsage::query()->create([
            'coupon_id' => $locked->id,
            'user_id' => $userId,
            'appointment_id' => $appointment->id,
            'discount_amount' => $discount,
        ]);

        return $discount;
    }

    private function assertUsable(Coupon $coupon, int $basketAmount): void
    {
        if (in_array($coupon->status, ['pending', 'active'], true) && $coupon->expires_at->isPast()) {
            $coupon->update(['status' => 'expired']);
        }
        if (
            $coupon->status !== 'active'
            || $coupon->expires_at->isPast()
            || $coupon->used_count >= $coupon->usage_limit
            || $basketAmount < $coupon->min_basket_amount
        ) {
            $this->invalidCoupon();
        }
    }

    private function discountAmount(Coupon $coupon, int $basketAmount): int
    {
        $discount = $coupon->discount_type === 'fixed'
            ? (int) $coupon->discount_value
            : (int) floor($basketAmount * $coupon->discount_value / 100);
        if ($coupon->discount_type === 'percentage' && $coupon->max_discount_amount !== null) {
            $discount = min($discount, $coupon->max_discount_amount);
        }
        $discount = min($discount, $basketAmount);
        if ($discount <= 0 || $discount >= $basketAmount) {
            throw ValidationException::withMessages([
                'coupon_code' => ['Kupon indirimi sepet toplamından küçük olmalıdır.'],
            ]);
        }

        return $discount;
    }

    private function invalidCoupon(): never
    {
        throw ValidationException::withMessages([
            'coupon_code' => ['Kupon kodu geçersiz, onaylanmamış veya kullanım şartları sağlanmıyor.'],
        ]);
    }
}
