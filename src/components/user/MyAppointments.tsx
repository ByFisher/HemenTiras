"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Star, X } from "lucide-react";
import { Dialog, DialogDescription, DialogPanel, DialogTitle } from "@headlessui/react";
import { appointmentApi, type AppointmentFilters } from "@/lib/services";
import { useApiMutation, useApiQuery } from "@/lib/use-api";
import { ErrorAlert, EmptyState, SkeletonRows } from "@/components/feedback/Skeleton";
import type { Appointment, StaffReview } from "@/types/api";
import { FormField, FormFieldset, FormTextarea } from "@/components/ui/form";
import { Description, Fieldset, Label, Radio, RadioGroup } from "@headlessui/react";

const TABS: { value: AppointmentFilters["status"]; label: string }[] = [
  { value: "upcoming", label: "Aktif Randevular" },
  { value: "past", label: "Geçmiş Randevular" },
];

const STATUS_LABEL: Record<Appointment["status"], string> = {
  pending: "Onay bekliyor",
  confirmed: "Onaylandı",
  completed: "Tamamlandı",
  cancelled: "İptal edildi",
  cancelled_by_shop: "Dükkan tarafından iptal edildi",
  no_show: "Gelmedi",
};

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" });
}

function RatingModal({ appointment, onClose }: { appointment: Appointment; onClose: () => void }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const submit = useApiMutation<{ rating: number; comment?: string }, StaffReview>(
    (input) => appointmentApi.review(appointment.id, input.rating, input.comment),
  );

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-3"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section role="dialog" aria-modal="true" aria-label="Randevuyu değerlendir" className="w-full max-w-sm space-y-4 rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Personeli Değerlendir</h2>
            <p className="mt-1 text-[11px] text-zinc-500">
              {appointment.staff?.firstName} {appointment.staff?.lastName} · {formatWhen(appointment.startsAt)}
            </p>
          </div>
          <button type="button" aria-label="Kapat" onClick={onClose} className="text-zinc-500 hover:text-zinc-200">
            <X size={16} />
          </button>
        </div>

        <Fieldset>
          <RadioGroup value={rating} onChange={setRating} className="flex items-center gap-1">
            <Label className="sr-only">Puan</Label>
            <Description className="sr-only">Personeli bir ile beş yıldız arasında değerlendirin.</Description>
            {[1, 2, 3, 4, 5].map((star) => (
              <Radio key={star} value={star} aria-label={`${star} yıldız`} className="cursor-pointer rounded p-1 outline-none data-[focus]:ring-2 data-[focus]:ring-zinc-400">
                <Star size={22} className={star <= rating ? "fill-amber-400 text-amber-400" : "text-zinc-700"} />
              </Radio>
            ))}
            <span className="ml-2 text-xs text-zinc-400">{rating}/5</span>
          </RadioGroup>
        </Fieldset>

        <FormFieldset className="space-y-4">
        <FormField label="Yorum (opsiyonel)" description="Deneyiminizi paylaşarak diğer müşterilere yardımcı olun.">
          <FormTextarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Deneyiminizi anlatın..."
          />
        </FormField>

        <ErrorAlert message={submit.error} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-zinc-800 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-900">
            Vazgeç
          </button>
          <button
            type="button"
            disabled={submit.isPending}
            onClick={async () => { if (await submit.run({ rating, comment })) onClose(); }}
            className="rounded-md bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-950 hover:bg-white disabled:opacity-50"
          >
            {submit.isPending ? "Gönderiliyor..." : "Değerlendirmeyi gönder"}
          </button>
        </div>
        </FormFieldset>
      </section>
    </div>
  );
}

function IyzicoCheckoutDialog({ appointment, onClose }: { appointment: Appointment; onClose: () => void }) {
  const [identityNumber, setIdentityNumber] = useState("");
  const [registrationAddress, setRegistrationAddress] = useState("");
  const checkout = useApiMutation<
    { identityNumber: string; registrationAddress: string },
    { checkoutUrl: string }
  >(({ identityNumber: identity, registrationAddress: address }) =>
    appointmentApi.startIyzicoCheckout(appointment.id, identity, address),
  );

  const startCheckout = async () => {
    const result = await checkout.run({ identityNumber, registrationAddress: registrationAddress.trim() });
    if (result) window.location.assign(result.checkoutUrl);
  };

  return (
    <Dialog open onClose={() => { if (!checkout.isPending) onClose(); }} className="relative z-[90]">
      <div className="fixed inset-0 bg-black/70" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-3">
        <DialogPanel className="w-full max-w-md space-y-4 rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
          <div>
            <DialogTitle className="text-sm font-semibold text-zinc-100">iyzico ile ödeme</DialogTitle>
            <DialogDescription className="mt-1 text-xs leading-relaxed text-zinc-400">
              {appointment.shop?.name} · {appointment.totalPrice.toLocaleString("tr-TR")} ₺
            </DialogDescription>
          </div>
          <p className="text-[11px] leading-relaxed text-zinc-500">
            Kimlik numaranız ve fatura adresiniz yalnızca ödeme isteği için iyzico’ya gönderilir; HemenTıraş veritabanında saklanmaz.
          </p>
          <label className="block space-y-1.5 text-xs text-zinc-400">
            <span>T.C. kimlik numarası</span>
            <input
              required
              inputMode="numeric"
              autoComplete="off"
              maxLength={11}
              value={identityNumber}
              onChange={(event) => setIdentityNumber(event.target.value.replace(/\D/g, ""))}
              className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-600"
            />
          </label>
          <label className="block space-y-1.5 text-xs text-zinc-400">
            <span>Fatura adresi</span>
            <textarea
              required
              maxLength={500}
              value={registrationAddress}
              onChange={(event) => setRegistrationAddress(event.target.value)}
              rows={3}
              className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-600"
            />
          </label>
          <ErrorAlert message={checkout.error} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} disabled={checkout.isPending} className="rounded-md border border-zinc-800 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-900 disabled:opacity-50">
              Vazgeç
            </button>
            <button
              type="button"
              onClick={() => void startCheckout()}
              disabled={checkout.isPending || identityNumber.length !== 11 || registrationAddress.trim().length < 5}
              className="rounded-md bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-950 hover:bg-white disabled:opacity-50"
            >
              {checkout.isPending ? "iyzico’ya bağlanıyor..." : "Güvenli ödemeye geç"}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

function AppointmentRow({
  appointment,
  onRate,
  onCancel,
  onDemoPay,
  onIyzicoPay,
  onVerifyIyzicoPay,
  cancelPending,
  verificationPending,
}: {
  appointment: Appointment;
  onRate: (appointment: Appointment) => void;
  onCancel: (id: string) => void;
  onDemoPay: (id: string) => void;
  onIyzicoPay: (appointment: Appointment) => void;
  onVerifyIyzicoPay: (id: string) => void;
  cancelPending: boolean;
  verificationPending: boolean;
}) {
  const isPast = appointment.status === "completed" || appointment.status === "cancelled" || appointment.status === "cancelled_by_shop" || appointment.status === "no_show";
  return (
    <li className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-100">{appointment.shop?.name ?? "Dükkan"}</p>
          <p className="mt-1 text-[11px] text-zinc-500">
            {appointment.staff?.firstName} {appointment.staff?.lastName} · {appointment.services?.map((service) => service.name).join(" + ") || appointment.service?.name}
          </p>
          <p className="mt-1 text-[11px] text-zinc-400">{formatWhen(appointment.startsAt)}</p>
        </div>
        <div className="space-y-1.5 text-right">
          <span className="inline-block rounded border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-300">
            {STATUS_LABEL[appointment.status]}
          </span>
          <p className="block text-xs text-zinc-200">{appointment.totalPrice.toLocaleString("tr-TR")} ₺</p>
          {!!appointment.discountAmount && appointment.discountAmount > 0 && (
            <p className="text-[10px] text-emerald-300">
              Kupon indirimi: −{appointment.discountAmount.toLocaleString("tr-TR")} ₺
            </p>
          )}
        </div>
      </div>
      {appointment.note && <p className="rounded bg-zinc-900/50 p-2.5 text-[11px] text-zinc-400">Not: {appointment.note}</p>}
      {appointment.payment.status === "refunded" && (
        <p role="status" className="rounded border border-zinc-800 bg-zinc-900/60 p-2.5 text-[11px] text-zinc-300">
          Ödeme iadesi tamamlandı: {appointment.payment.refundAmount.toLocaleString("tr-TR")} ₺ · {appointment.payment.currency}
        </p>
      )}
      {appointment.payment.status === "refund_pending" && (
        <p role="status" className="rounded border border-zinc-800 bg-zinc-900/60 p-2.5 text-[11px] text-zinc-300">Ödeme iadesi işleniyor.</p>
      )}
      {appointment.payment.status === "refund_failed" && (
        <p role="alert" className="rounded border border-rose-900 bg-rose-950/30 p-2.5 text-[11px] text-rose-300">İade henüz tamamlanmadı. Dükkanla iletişime geçerek iade işleminin tekrar denenmesini isteyin.</p>
      )}
      {appointment.payment.provider === "offline" && appointment.payment.status === "pending" && (
        <p className="rounded border border-zinc-800 bg-zinc-900/60 p-2.5 text-[11px] text-zinc-400">
          {appointment.payment.method === "cash" ? "Ödeme randevu sırasında nakit alınacaktır." : "Ödeme randevu sırasında dükkanda kartla alınacaktır."}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {appointment.status === "completed" && !appointment.isRated && (
          <button
            type="button"
            onClick={() => onRate(appointment)}
            className="rounded border border-amber-900 bg-amber-950/30 px-3 py-1.5 text-[11px] text-amber-200 hover:bg-amber-950/60"
          >
            Puan ver & yorum yap
          </button>
        )}
        {appointment.payment.provider === "iyzico" && appointment.payment.status === "pending" && (
          <button
            type="button"
            disabled={verificationPending}
            onClick={() => onVerifyIyzicoPay(appointment.id)}
            className="rounded border border-zinc-700 px-3 py-1.5 text-[11px] text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
          >
            {verificationPending ? "Durum kontrol ediliyor..." : "Ödeme durumunu kontrol et"}
          </button>
        )}
        {appointment.status === "completed" && appointment.isRated && (
          <span className="text-[11px] text-emerald-400">✓ Değerlendirildi</span>
        )}
        {(appointment.status === "pending" || appointment.status === "confirmed") && (
          <>
            {appointment.demoPaymentEnabled && appointment.payment.status === "unpaid" && (
              <button
                type="button"
                onClick={() => onDemoPay(appointment.id)}
                className="rounded border border-zinc-700 px-3 py-1.5 text-[11px] text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
              >
                Demo ödemeyi tamamla
              </button>
            )}
            {appointment.payment.provider === "iyzico" && ["unpaid", "failed"].includes(appointment.payment.status) && (
              <button
                type="button"
                onClick={() => onIyzicoPay(appointment)}
                className="rounded border border-zinc-700 px-3 py-1.5 text-[11px] text-zinc-300 hover:bg-zinc-900"
              >
                iyzico ile öde
              </button>
            )}
            <button
              type="button"
              disabled={cancelPending}
              onClick={() => onCancel(appointment.id)}
              className="rounded border border-rose-900 px-3 py-1.5 text-[11px] text-rose-300 hover:bg-rose-950/40 disabled:opacity-50"
            >
              {cancelPending ? "İptal ediliyor..." : "Randevuyu iptal et"}
            </button>
            {appointment.shop && (
              <Link
                href={`/shops/${appointment.shop.id}`}
                className="rounded border border-zinc-800 px-3 py-1.5 text-[11px] text-zinc-300 hover:bg-zinc-900"
              >
                Dükkanı görüntüle
              </Link>
            )}
          </>
        )}
        {isPast && appointment.service && <span className="self-center text-[10px] text-zinc-600">Hizmet: {appointment.service.name}</span>}
      </div>
    </li>
  );
}

export function MyAppointments() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<AppointmentFilters["status"]>("upcoming");
  const [ratingTarget, setRatingTarget] = useState<Appointment | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [checkoutTarget, setCheckoutTarget] = useState<Appointment | null>(null);
  const [dismissedCheckoutId, setDismissedCheckoutId] = useState<string | null>(null);

  const appointments = useApiQuery<Appointment[]>(["/appointments", tab], { list: true, query: { status: tab } });
  const cancel = useApiMutation<string, Appointment>(appointmentApi.cancel);
  const verifyIyzicoPay = useApiMutation<string, Appointment>(appointmentApi.verifyIyzicoCheckout);

  const created = searchParams.get("created") === "1";
  const paymentResult = searchParams.get("payment");
  const checkoutId = searchParams.get("checkout");
  const autoCheckoutTarget = checkoutId && dismissedCheckoutId !== checkoutId
    ? appointments.data?.find((item) => item.id === checkoutId
      && item.payment.provider === "iyzico"
      && ["unpaid", "failed"].includes(item.payment.status)) ?? null
    : null;
  const activeCheckoutTarget = checkoutTarget ?? autoCheckoutTarget;

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Randevularım</h1>
        <p className="mt-1 text-xs text-zinc-500">Aktif ve geçmiş randevularınız; tamamlananlar için değerlendirme yapabilirsiniz.</p>
      </div>

      {created && (
        <p role="status" className="rounded-md border border-emerald-900 bg-emerald-950/30 p-3 text-xs text-emerald-300">
          Randevunuz oluşturuldu. Dükkan onayladığında bildirim alacaksınız.
        </p>
      )}
      {paymentResult === "success" && (
        <p role="status" className="rounded-md border border-emerald-900 bg-emerald-950/30 p-3 text-xs text-emerald-300">iyzico ödemeniz başarıyla tamamlandı.</p>
      )}
      {paymentResult === "demo-success" && (
        <p role="status" className="rounded-md border border-emerald-900 bg-emerald-950/30 p-3 text-xs text-emerald-300">Demo ödeme tamamlandı. Gerçek tahsilat yapılmadı ve kart bilgileriniz kaydedilmedi.</p>
      )}
      {paymentResult === "refunded" && (
        <p role="status" className="rounded-md border border-emerald-900 bg-emerald-950/30 p-3 text-xs text-emerald-300">İptal edilen randevunun ödemesi otomatik olarak iade edildi.</p>
      )}
      {paymentResult === "failed" && (
        <p role="alert" className="rounded-md border border-rose-900 bg-rose-950/30 p-3 text-xs text-rose-300">iyzico ödemesi tamamlanmadı. Randevunuzdan tekrar ödeme başlatabilirsiniz.</p>
      )}
      {paymentResult === "refund-failed" && (
        <p role="alert" className="rounded-md border border-rose-900 bg-rose-950/30 p-3 text-xs text-rose-300">Ödeme alındı ancak otomatik iade tamamlanamadı. Dükkanla iletişime geçerek iadenin durumunu öğrenin.</p>
      )}
      {paymentResult === "verification-pending" && (
        <p role="status" className="rounded-md border border-amber-900 bg-amber-950/30 p-3 text-xs text-amber-300">iyzico ödeme sonucu doğrulanıyor. Randevu kartındaki “Ödeme durumunu kontrol et” düğmesiyle tekrar deneyebilirsiniz.</p>
      )}

      <div className="flex gap-2" role="tablist" aria-label="Randevu filtresi">
        {TABS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={tab === option.value}
            onClick={() => setTab(option.value)}
            className={`rounded-md border px-3 py-2 text-xs ${
              tab === option.value ? "border-zinc-600 bg-zinc-800 text-zinc-100" : "border-zinc-800 text-zinc-500 hover:text-zinc-200"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <ErrorAlert message={appointments.error} onRetry={appointments.refresh} />
      {cancel.error && <ErrorAlert message={cancel.error} />}
      {verifyIyzicoPay.error && <ErrorAlert message={verifyIyzicoPay.error} />}
      {(appointments.data ?? []).some((appointment) => appointment.demoPaymentEnabled) && (
        <p className="rounded-md border border-zinc-800 bg-zinc-950 p-3 text-[11px] text-zinc-400">
          Demo ödeme modu: iyzico benzeri test ekranına geçilir. Kart bilgileri sunucuya gönderilmez ve gerçek tahsilat yapılmaz.
        </p>
      )}

      {appointments.isLoading ? (
        <SkeletonRows rows={3} columns={3} />
      ) : (appointments.data ?? []).length === 0 ? (
        <EmptyState message="Bu listede randevunuz bulunmuyor." />
      ) : (
        <ul className="space-y-3">
          {(appointments.data ?? []).map((appointment) => (
            <AppointmentRow
              key={appointment.id}
              appointment={appointment}
              onRate={setRatingTarget}
              onDemoPay={(id) => router.push(`/demo-iyzico/${encodeURIComponent(id)}`)}
              onIyzicoPay={setCheckoutTarget}
              onVerifyIyzicoPay={(id) => {
                setVerifyingId(id);
                void verifyIyzicoPay.run(id)
                  .then((result) => { if (result) appointments.refresh(); })
                  .finally(() => setVerifyingId(null));
              }}
              cancelPending={cancellingId === appointment.id}
              verificationPending={verifyingId === appointment.id}
              onCancel={async (id) => {
                setCancellingId(id);
                if (await cancel.run(id)) appointments.refresh();
                setCancellingId(null);
              }}
            />
          ))}
        </ul>
      )}

      {ratingTarget && <RatingModal appointment={ratingTarget} onClose={() => { setRatingTarget(null); appointments.refresh(); }} />}
      {activeCheckoutTarget && (
        <IyzicoCheckoutDialog
          key={activeCheckoutTarget.id}
          appointment={activeCheckoutTarget}
          onClose={() => {
            setCheckoutTarget(null);
            if (checkoutId) setDismissedCheckoutId(checkoutId);
          }}
        />
      )}
    </section>
  );
}
