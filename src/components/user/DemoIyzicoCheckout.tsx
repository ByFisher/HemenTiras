"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { ErrorAlert, SkeletonRows } from "@/components/feedback/Skeleton";
import { appointmentApi } from "@/lib/services";
import { useApiMutation, useApiQuery } from "@/lib/use-api";
import type { Appointment } from "@/types/api";

function CardField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5 text-xs text-zinc-300">
      <span>{label}</span>
      {children}
    </label>
  );
}

const inputClassName = "w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-sky-500";

export function DemoIyzicoCheckout({ appointmentId }: { appointmentId: string }) {
  const router = useRouter();
  const appointment = useApiQuery<Appointment>(["/appointments/:appointmentId", appointmentId]);
  const payment = useApiMutation<string, Appointment>(appointmentApi.demoPay);
  const [cardholder, setCardholder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");

  const submitPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = await payment.run(appointmentId);
    if (!result) return;

    setCardholder("");
    setCardNumber("");
    setExpiry("");
    setCvc("");
    router.replace("/my-appointments?payment=demo-success");
  };

  const visit = appointment.data;
  const canPay = visit
    && visit.demoPaymentEnabled
    && ["pending", "confirmed"].includes(visit.status)
    && visit.payment.status === "unpaid";

  return (
    <main className="mx-auto min-h-[calc(100vh-8rem)] max-w-5xl px-4 py-8 text-zinc-100">
      <Link href="/my-appointments" className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-100">
        <ArrowLeft size={14} />
        Randevularıma dön
      </Link>

      <div className="mx-auto mt-7 grid max-w-4xl gap-5 md:grid-cols-[1fr_360px]">
        <section className="space-y-5 rounded-xl border border-zinc-800 bg-zinc-950 p-5 sm:p-7">
          <header className="flex items-center justify-between border-b border-zinc-800 pb-4">
            <div>
              <p className="text-lg font-semibold tracking-tight">iyzico <span className="text-sky-400">demo</span></p>
              <p className="mt-1 text-[11px] text-zinc-500">Güvenli ödeme simülasyonu</p>
            </div>
            <LockKeyhole size={18} className="text-sky-400" aria-hidden="true" />
          </header>

          <div className="rounded-lg border border-amber-900/70 bg-amber-950/25 p-3 text-[11px] leading-5 text-amber-200">
            Bu, gerçek iyzico ödeme sayfası değildir. İstediğiniz test kartı bilgilerini girebilirsiniz; kart bilgileri tarayıcıdan gönderilmez, kaydedilmez ve gerçek tahsilat yapılmaz.
          </div>

          {appointment.isLoading ? (
            <SkeletonRows rows={3} columns={1} />
          ) : appointment.error ? (
            <ErrorAlert message={appointment.error} />
          ) : !visit ? (
            <ErrorAlert message="Randevu bilgisi alınamadı." />
          ) : !visit.demoPaymentEnabled ? (
            <p role="alert" className="rounded-md border border-rose-900 bg-rose-950/30 p-3 text-xs text-rose-300">
              Demo ödeme bu ortamda kullanılamıyor.
            </p>
          ) : !canPay ? (
            <p role="status" className="rounded-md border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-300">
              Bu randevu için demo ödeme başlatılamaz veya ödeme zaten tamamlanmış.
            </p>
          ) : (
            <form className="space-y-4" onSubmit={(event) => void submitPayment(event)}>
              <CardField label="Kart üzerindeki isim">
                <input
                  autoComplete="off"
                  className={inputClassName}
                  maxLength={100}
                  onChange={(event) => setCardholder(event.target.value)}
                  placeholder="AD SOYAD"
                  required
                  value={cardholder}
                />
              </CardField>

              <CardField label="Kart numarası">
                <input
                  autoComplete="off"
                  className={inputClassName}
                  inputMode="numeric"
                  maxLength={19}
                  minLength={12}
                  onChange={(event) => setCardNumber(event.target.value.replace(/\D/g, "").slice(0, 19))}
                  pattern="[0-9]{12,19}"
                  placeholder="1234 5678 9012 3456"
                  required
                  value={cardNumber}
                />
              </CardField>

              <div className="grid grid-cols-2 gap-3">
                <CardField label="Son kullanma tarihi">
                  <input
                    autoComplete="off"
                    className={inputClassName}
                    inputMode="numeric"
                    maxLength={5}
                    onChange={(event) => {
                      const digits = event.target.value.replace(/\D/g, "").slice(0, 4);
                      setExpiry(digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits);
                    }}
                    pattern="(0[1-9]|1[0-2])/[0-9]{2}"
                    placeholder="AA/YY"
                    required
                    value={expiry}
                  />
                </CardField>
                <CardField label="Güvenlik kodu">
                  <input
                    autoComplete="off"
                    className={inputClassName}
                    inputMode="numeric"
                    maxLength={4}
                    minLength={3}
                    onChange={(event) => setCvc(event.target.value.replace(/\D/g, "").slice(0, 4))}
                    pattern="[0-9]{3,4}"
                    placeholder="123"
                    required
                    value={cvc}
                  />
                </CardField>
              </div>

              <ErrorAlert message={payment.error} />
              <button
                className="w-full rounded-md bg-sky-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-wait disabled:opacity-60"
                disabled={payment.isPending}
                type="submit"
              >
                {payment.isPending
                  ? "Demo ödeme işleniyor..."
                  : `${visit.payment.amount.toLocaleString("tr-TR")} ${visit.payment.currency} · Ödemeyi tamamla`}
              </button>
            </form>
          )}
        </section>

        <aside className="h-fit space-y-4 rounded-xl border border-zinc-800 bg-zinc-950 p-5">
          <h1 className="text-sm font-semibold">Sipariş özeti</h1>
          {visit ? (
            <>
              <div className="space-y-1 text-xs">
                <p className="text-zinc-100">{visit.shop?.name ?? "Randevu"}</p>
                <p className="text-zinc-500">{visit.service?.name ?? "Randevu hizmeti"}</p>
                <p className="text-zinc-500">{new Date(visit.startsAt).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })}</p>
              </div>
              <div className="flex justify-between border-t border-zinc-800 pt-4 text-sm">
                <span className="text-zinc-400">Toplam</span>
                <strong>{visit.payment.amount.toLocaleString("tr-TR")} {visit.payment.currency}</strong>
              </div>
            </>
          ) : (
            <p className="text-xs text-zinc-500">Randevu bilgisi yükleniyor...</p>
          )}
        </aside>
      </div>
    </main>
  );
}
