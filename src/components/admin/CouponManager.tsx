"use client";

import { useState, type FormEvent } from "react";
import { ErrorAlert, SkeletonRows } from "@/components/feedback/Skeleton";
import { FormField, FormInput, FormListbox } from "@/components/ui/form";
import { post } from "@/lib/api-client";
import { useApiMutation, useApiQuery } from "@/lib/use-api";
import type { Paginated } from "@/types/api";

type CouponStatus = "pending" | "active" | "rejected" | "expired";
type DiscountType = "fixed" | "percentage";

interface Coupon {
  id: string;
  code: string;
  shopName: string | null;
  createdByName: string | null;
  discountType: DiscountType;
  discountValue: number;
  maxDiscountAmount: number | null;
  minBasketAmount: number;
  usageLimit: number;
  usedCount: number;
  reservedBudget: number;
  status: CouponStatus;
  expiresAt: string;
  usageCount: number | null;
}

interface CouponInput {
  code?: string;
  discount_type: DiscountType;
  discount_value: number;
  max_discount_amount?: number;
  min_basket_amount: number;
  usage_limit: number;
  expires_at: string;
}

const STATUS_LABEL: Record<CouponStatus, string> = {
  pending: "Onay bekliyor",
  active: "Aktif",
  rejected: "Reddedildi",
  expired: "Süresi doldu",
};

const DISCOUNT_OPTIONS = [
  { value: "fixed", label: "Sabit tutar (₺)" },
  { value: "percentage", label: "Yüzde (%)" },
] as const;

function defaultExpiry() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 16);
}

export function CouponManager({ admin = false }: { admin?: boolean }) {
  const [status, setStatus] = useState<CouponStatus | "">("pending");
  const [page, setPage] = useState(1);
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("fixed");
  const [discountValue, setDiscountValue] = useState("100");
  const [maxDiscountAmount, setMaxDiscountAmount] = useState("500");
  const [minBasketAmount, setMinBasketAmount] = useState("0");
  const [usageLimit, setUsageLimit] = useState("10");
  const [expiresAt, setExpiresAt] = useState(defaultExpiry);
  const [rejectionReason, setRejectionReason] = useState("");
  const path = admin ? "/admin/coupons" : "/shop/coupons";
  const coupons = useApiQuery<Paginated<Coupon> | Coupon[]>(
    [path, status, page],
    { query: admin ? { status, page, per_page: 100 } : { page, per_page: 100 } },
  );
  const createCoupon = useApiMutation<CouponInput, Coupon>((input) => post<Coupon>(path, input));
  const decideCoupon = useApiMutation<{ id: string; decision: "approve" | "reject" }, Coupon>(
    ({ id, decision }) => post<Coupon>(`${path}/${encodeURIComponent(id)}/${decision}`, decision === "reject" ? { rejection_reason: rejectionReason } : {}),
  );
  const rows = Array.isArray(coupons.data) ? coupons.data : coupons.data?.data ?? [];
  const meta = coupons.data && !Array.isArray(coupons.data) ? coupons.data.meta : undefined;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = await createCoupon.run({
      code: code.trim() || undefined,
      discount_type: discountType,
      discount_value: Number(discountValue),
      ...(discountType === "percentage" ? { max_discount_amount: Number(maxDiscountAmount) } : {}),
      min_basket_amount: Number(minBasketAmount),
      usage_limit: Number(usageLimit),
      expires_at: new Date(expiresAt).toISOString(),
    });
    if (result) {
      setCode("");
      setPage(1);
      coupons.refresh();
    }
  };

  const decide = async (coupon: Coupon, decision: "approve" | "reject") => {
    if (decision === "reject" && !rejectionReason.trim()) return;
    const result = await decideCoupon.run({ id: coupon.id, decision });
    if (result) coupons.refresh();
  };

  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 sm:p-5">
        <h2 className="text-sm font-medium text-zinc-100">{admin ? "Platform kuponu oluştur" : "Dükkana kupon öner"}</h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          {admin
            ? "Süper yönetici tarafından oluşturulan kuponlar doğrudan aktif edilir."
            : "Dükkan kuponları maliyet rezervi bakiyeden kontrol edilerek inceleme onayına gönderilir."}
        </p>
        <form onSubmit={(event) => void submit(event)} className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <FormField label="Kupon kodu" description="Boş bırakırsanız otomatik üretilir. Harf, rakam, tire ve alt çizgi kullanabilirsiniz; boşluklar kayıtta kaldırılır.">
              <FormInput value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} minLength={4} maxLength={64} />
            </FormField>
            <FormListbox
              label="İndirim türü"
              description="Yüzde indiriminde azami tutar belirleyin."
              value={discountType}
              onChange={(value) => { if (value) setDiscountType(value); }}
              options={DISCOUNT_OPTIONS}
              clearable={false}
            />
            <FormField label={discountType === "fixed" ? "İndirim (₺)" : "İndirim (%)"} description="İndirim miktarı.">
              <FormInput type="number" min="1" max={discountType === "percentage" ? "100" : undefined} step="1" required value={discountValue} onChange={(event) => setDiscountValue(event.target.value)} />
            </FormField>
            {discountType === "percentage" && (
              <FormField label="Azami indirim (₺)" description="Bütçe rezervi ve kullanım başına üst sınır.">
                <FormInput type="number" min="1" step="1" required value={maxDiscountAmount} onChange={(event) => setMaxDiscountAmount(event.target.value)} />
              </FormField>
            )}
            <FormField label="Minimum sepet (₺)" description="Kuponun uygulanacağı en düşük tutar.">
              <FormInput type="number" min="0" step="1" required value={minBasketAmount} onChange={(event) => setMinBasketAmount(event.target.value)} />
            </FormField>
            <FormField label="Kullanım limiti" description="Toplam müşteri kullanım sayısı.">
              <FormInput type="number" min="1" max="100000" step="1" required value={usageLimit} onChange={(event) => setUsageLimit(event.target.value)} />
            </FormField>
            <FormField label="Son kullanım tarihi" description="Kuponun geçerlilik bitişi.">
              <FormInput type="datetime-local" required value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
            </FormField>
          </div>
          <ErrorAlert message={createCoupon.error} />
          <button type="submit" disabled={createCoupon.isPending} className="rounded-md bg-lime-400 px-4 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-lime-300 disabled:opacity-50">
            {createCoupon.isPending ? "Kaydediliyor…" : admin ? "Aktif kupon oluştur" : "Onaya gönder"}
          </button>
        </form>
      </div>

      {admin && (
        <FormListbox
          label="Durum filtresi"
          description="Onay kuyruğunu ve diğer kuponları inceleyin."
          value={status}
          onChange={(value) => { setStatus(value); setPage(1); }}
          options={[
            { value: "pending", label: STATUS_LABEL.pending },
            { value: "active", label: STATUS_LABEL.active },
            { value: "rejected", label: STATUS_LABEL.rejected },
            { value: "expired", label: STATUS_LABEL.expired },
          ]}
          placeholder="Tüm durumlar"
        />
      )}
      <ErrorAlert message={coupons.error || decideCoupon.error} onRetry={coupons.refresh} />
      {coupons.isLoading ? <SkeletonRows rows={4} columns={5} /> : rows.length === 0 ? (
        <p className="rounded-lg border border-zinc-800 bg-zinc-950 p-8 text-center text-xs text-zinc-500">Kupon kaydı bulunamadı.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((coupon) => (
            <li key={coupon.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm font-semibold text-zinc-100">{coupon.code}</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {coupon.discountType === "fixed" ? `${coupon.discountValue} ₺` : `%${coupon.discountValue} · en çok ${coupon.maxDiscountAmount} ₺`}
                    {" · "}{coupon.usedCount}/{coupon.usageLimit} kullanım
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-600">
                    {coupon.shopName ?? "Platform"} · minimum sepet {coupon.minBasketAmount} ₺ · bitiş {new Date(coupon.expiresAt).toLocaleString("tr-TR")}
                  </p>
                  {!admin && <p className="mt-1 text-[11px] text-zinc-600">Ayrılan kupon bütçesi: {coupon.reservedBudget.toLocaleString("tr-TR")} ₺</p>}
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] ${coupon.status === "active" ? "border-emerald-900 text-emerald-300" : "border-zinc-700 text-zinc-400"}`}>
                  {STATUS_LABEL[coupon.status]}
                </span>
              </div>
              {admin && coupon.status === "pending" && (
                <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-zinc-800 pt-3">
                  <FormField label="Ret gerekçesi" description="Ret işleminde zorunludur.">
                    <FormInput value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} maxLength={500} />
                  </FormField>
                  <button type="button" disabled={decideCoupon.isPending} onClick={() => void decide(coupon, "approve")} className="rounded-md bg-lime-400 px-3 py-2 text-xs font-semibold text-zinc-950 disabled:opacity-50">Onayla</button>
                  <button type="button" disabled={decideCoupon.isPending || !rejectionReason.trim()} onClick={() => void decide(coupon, "reject")} className="rounded-md border border-rose-900 px-3 py-2 text-xs text-rose-300 disabled:opacity-50">Reddet</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {meta && meta.lastPage > 1 && (
        <nav aria-label="Kupon sayfaları" className="flex items-center justify-between text-xs text-zinc-400">
          <span>{meta.total.toLocaleString("tr-TR")} kayıttan {page}. sayfa</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded border border-zinc-800 px-3 py-2 disabled:opacity-40">Önceki</button>
            <button type="button" disabled={page >= meta.lastPage} onClick={() => setPage((current) => current + 1)} className="rounded border border-zinc-800 px-3 py-2 disabled:opacity-40">Sonraki</button>
          </div>
        </nav>
      )}
    </section>
  );
}
