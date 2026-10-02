"use client";

import { useState } from "react";
import { Dialog, DialogDescription, DialogPanel, DialogTitle } from "@headlessui/react";
import { shopAppointmentApi } from "@/lib/services";
import { useApiMutation, useApiQuery } from "@/lib/use-api";
import { ErrorAlert, EmptyState, SkeletonRows } from "@/components/feedback/Skeleton";
import type { Appointment, AppointmentStatus } from "@/types/api";
import { FormField, FormFieldset, FormTextarea } from "@/components/ui/form";

const FILTERS: { value: AppointmentStatus | ""; label: string }[] = [
  { value: "", label: "Yaklaşan ve son randevular" },
  { value: "pending", label: "Onay bekleyen" },
  { value: "confirmed", label: "Onaylanan" },
  { value: "cancelled", label: "İptal edilen" },
  { value: "cancelled_by_shop", label: "Dükkan tarafından iptal edilen" },
];

const PAYMENT_LABEL: Record<Appointment["payment"]["status"], string> = {
  unpaid: "Ödenmedi",
  pending: "Ödeme bekliyor",
  paid: "Tahsil edildi",
  failed: "Ödeme başarısız",
  refund_pending: "İade işleniyor",
  refunded: "İade edildi",
  refund_failed: "İade tekrar denenmeli",
};

function when(value: string) {
  return new Date(value).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });
}

export function ShopAppointmentsPanel() {
  const [status, setStatus] = useState<AppointmentStatus | "">("");
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState("");
  const appointments = useApiQuery<Appointment[]>(
    ["/shop/appointments", status],
    { list: true, query: { status: status || undefined } },
  );
  const cancel = useApiMutation<{ id: string; reason?: string }, Appointment>(
    ({ id, reason: cancelReason }) => shopAppointmentApi.cancel(id, cancelReason),
  );

  const closeDialog = () => {
    setCancelTarget(null);
    setReason("");
    cancel.reset();
  };

  const confirmCancellation = async () => {
    if (!cancelTarget) return;
    const result = await cancel.run({ id: cancelTarget.id, reason: reason.trim() || undefined });
    if (!result) {
      appointments.refresh();
      return;
    }
    setNotice(result.payment.status === "refunded"
      ? `Randevu iptal edildi; ${result.payment.refundAmount.toLocaleString("tr-TR")} ₺ tam iade başlatıldı.`
      : "Randevu iptal edildi. Bu randevu için tahsil edilmiş ödeme bulunmadığından iade gerekmedi.");
    appointments.refresh();
    closeDialog();
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2" aria-label="Randevu durum filtresi">
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            aria-pressed={status === filter.value}
            onClick={() => setStatus(filter.value)}
            className={`rounded-md border px-3 py-2 text-xs ${status === filter.value ? "border-zinc-600 bg-zinc-800 text-zinc-100" : "border-zinc-800 text-zinc-500 hover:text-zinc-200"}`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {notice && <p role="status" className="rounded-md border border-zinc-700 bg-zinc-900 p-3 text-xs text-zinc-200">{notice}</p>}
      <ErrorAlert message={appointments.error} onRetry={appointments.refresh} />

      {appointments.isLoading ? (
        <SkeletonRows rows={3} columns={3} />
      ) : (appointments.data ?? []).length === 0 ? (
        <EmptyState message="Bu filtrede randevu bulunmuyor." />
      ) : (
        <ul className="space-y-3">
          {(appointments.data ?? []).map((appointment) => (
            <li key={appointment.id} className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-zinc-100">
                    {appointment.services?.map((service) => service.name).join(" + ") || appointment.service?.name || "Hizmet"} · {appointment.shop?.name ?? "Dükkan"}
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    {appointment.staff?.firstName} {appointment.staff?.lastName} · {when(appointment.startsAt)}
                  </p>
                  <p className="mt-1 text-[10px] text-zinc-600">Randevu #{appointment.id} · Müşteri #{appointment.customerId}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-zinc-200">{appointment.totalPrice.toLocaleString("tr-TR")} ₺</p>
                  <p className="mt-1 text-[10px] text-zinc-500">{PAYMENT_LABEL[appointment.payment.status]}</p>
                </div>
              </div>
              {appointment.cancellationReason && (
                <p className="rounded bg-zinc-900/60 p-2.5 text-[11px] text-zinc-400">İptal nedeni: {appointment.cancellationReason}</p>
              )}
              {appointment.payment.status === "refunded" && (
                <p role="status" className="rounded border border-zinc-800 bg-zinc-900/60 p-2.5 text-[11px] text-zinc-300">
                  Tam iade: {appointment.payment.refundAmount.toLocaleString("tr-TR")} ₺ · {appointment.payment.currency}
                </p>
              )}
              {(appointment.status === "pending" || appointment.status === "confirmed" || appointment.payment.status === "refund_failed") && (
                <button
                  type="button"
                  onClick={() => { setNotice(""); cancel.reset(); setCancelTarget(appointment); }}
                  className="rounded border border-rose-900 px-3 py-1.5 text-[11px] text-rose-300 hover:bg-rose-950/40"
                >
                  {appointment.payment.status === "refund_failed" ? "İadeyi tekrar dene" : "Randevuyu iptal et"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={cancelTarget !== null} onClose={closeDialog} className="relative z-[90]">
        <div className="fixed inset-0 bg-black/70" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-3">
          <DialogPanel className="w-full max-w-md space-y-4 rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
            <div>
              <DialogTitle className="text-sm font-semibold text-zinc-100">Randevuyu iptal et</DialogTitle>
              <DialogDescription className="mt-1 text-xs leading-relaxed text-zinc-400">
                {cancelTarget?.payment.status === "paid"
                  ? `${cancelTarget.payment.amount.toLocaleString("tr-TR")} ₺ tahsilatın tamamı bağlı ödeme sağlayıcısı üzerinden otomatik iade edilecek.`
                  : "Bu randevu için tahsil edilmiş ödeme bulunmuyor; iptal kaydı oluşturulacak ve iade yapılmayacak."}
              </DialogDescription>
            </div>
            <FormFieldset>
              <FormField label="İptal nedeni (isteğe bağlı)" description="Müşteri randevu ayrıntılarında bu nedeni görebilir.">
                <FormTextarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder="Kısa bir açıklama yazın..." />
              </FormField>
            </FormFieldset>
            <ErrorAlert message={cancel.error} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeDialog} disabled={cancel.isPending} className="rounded-md border border-zinc-800 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-900 disabled:opacity-50">Vazgeç</button>
              <button type="button" onClick={() => void confirmCancellation()} disabled={cancel.isPending} className="rounded-md bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-950 hover:bg-white disabled:opacity-50">
                {cancel.isPending
                  ? "İşleniyor..."
                  : cancelTarget?.payment.status === "refund_failed"
                    ? "Tam iadeyi tekrar dene"
                    : cancelTarget?.payment.status === "paid"
                      ? "İptal et ve tam iade et"
                      : "Randevuyu iptal et"}
              </button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </section>
  );
}
