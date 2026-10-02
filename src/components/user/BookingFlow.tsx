"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Check, Star } from "lucide-react";
import { useApiQuery } from "@/lib/use-api";
import { ErrorAlert, SkeletonRows } from "@/components/feedback/Skeleton";
import type { AppointmentSlot, Service, Shop, Staff } from "@/types/api";
import { FormField, FormFieldset, FormInput } from "@/components/ui/form";

type Step = 1 | 2 | 3 | 4;

const STEP_LABELS: Record<Step, string> = {
  1: "Personel",
  2: "Hizmet",
  3: "Tarih & Saat",
  4: "Onay",
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function BookingFlow({ shopId }: { shopId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>(1);
  const [staffId, setStaffId] = useState<string | null>(searchParams.get("staffId"));
  const [serviceIds, setServiceIds] = useState<string[]>(() => {
    const initialServiceIds = searchParams.get("serviceIds")?.split(",")
      ?? searchParams.getAll("serviceId");
    return [...new Set(initialServiceIds.filter((id) => /^\d+$/.test(id)))].slice(0, 10);
  });
  const [date, setDate] = useState(todayIso());
  const [slot, setSlot] = useState<AppointmentSlot | null>(null);

  const shop = useApiQuery<Shop>(["/shops/:id", shopId]);
  const staff = useApiQuery<Staff[]>(["/shops/:id/staff", shopId], { list: true });
  const services = useApiQuery<Service[]>(["/shops/:id/services", shopId], { list: true });
  const slots = useApiQuery<AppointmentSlot[]>(
    ["/shops/:id/staff/:staffId/availability", shopId, staffId, serviceIds.join(","), date],
    {
      enabled: Boolean(staffId && serviceIds.length && date),
      list: true,
      query: { service_ids: serviceIds.join(","), date },
    },
  );

  const selectedStaff = useMemo(
    () => (staff.data ?? []).find((member) => member.id === staffId) ?? null,
    [staff.data, staffId],
  );
  const selectedServices = useMemo(
    () => serviceIds.flatMap((id) => (services.data ?? []).filter((service) => service.id === id)),
    [services.data, serviceIds],
  );
  const basePrice = selectedServices.reduce((sum, service) => sum + service.price, 0);
  const totalDuration = selectedServices.reduce((sum, service) => sum + service.durationMinutes, 0);
  /** Personelin sunduğu hizmetler varsa onlarla sınırla. */
  const availableServices = useMemo(() => {
    const all = services.data ?? [];
    if (!selectedStaff || selectedStaff.services.length === 0) return all;
    const allowed = new Set(selectedStaff.services.map((service) => service.id));
    return all.filter((service) => allowed.has(service.id));
  }, [services.data, selectedStaff]);

  const continueToCheckout = () => {
    if (!staffId || serviceIds.length === 0 || !slot) return;
    const query = new URLSearchParams({
      shopId,
      staffId,
      serviceIds: serviceIds.join(","),
      startsAt: slot.startsAt,
    });
    router.push(`/checkout?${query.toString()}`);
  };

  const toggleService = (id: string) => {
    setServiceIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    setSlot(null);
  };

  return (
    <section className="space-y-5">
      <div>
        <Link href={`/shops/${shopId}`} className="text-[11px] text-zinc-500 hover:text-zinc-200">← Dükkan profiline dön</Link>
        <h1 className="mt-2 text-lg font-semibold tracking-tight">Randevu Al</h1>
        <p className="mt-1 text-xs text-zinc-500">{shop.data?.name ?? "Dükkan yükleniyor…"}</p>
      </div>

      <ol className="flex flex-wrap gap-2 text-[11px]">
        {(Object.keys(STEP_LABELS) as unknown as Step[]).map((value) => (
          <li
            key={value}
            aria-current={step === value ? "step" : undefined}
            className={`rounded-md border px-3 py-1.5 ${
              step === value
                ? "border-zinc-600 bg-zinc-800 text-zinc-100"
                : value < step
                  ? "border-emerald-900 bg-emerald-950/40 text-emerald-300"
                  : "border-zinc-800 text-zinc-600"
            }`}
          >
            {value < step && <Check size={10} className="mr-1 inline" />}
            {value}. {STEP_LABELS[value]}
          </li>
        ))}
      </ol>

      <ErrorAlert message={shop.error || staff.error || services.error} onRetry={shop.refresh} />

      {step === 1 && (
        <div className="space-y-3">
          {staff.isLoading ? (
            <SkeletonRows rows={3} columns={2} />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {(staff.data ?? []).filter((member) => member.isApproved).map((member) => (
                <li key={member.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setStaffId(member.id);
                      setServiceIds((current) => {
                        if (member.services.length === 0) return current;
                        const allowed = new Set(member.services.map((service) => service.id));
                        return current.filter((id) => allowed.has(id));
                      });
                      setSlot(null);
                      setStep(2);
                    }}
                    className={`w-full rounded-lg border p-4 text-left ${
                      staffId === member.id ? "border-zinc-600 bg-zinc-800/60" : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
                    }`}
                  >
                    <p className="text-sm font-medium text-zinc-100">{member.firstName} {member.lastName}</p>
                    <p className="mt-1 text-[11px] text-zinc-500">{member.title} · {member.experienceYears} yıl deneyim</p>
                    <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-amber-300">
                      <Star size={10} className="fill-amber-400 text-amber-400" />
                      {member.averageRating.toFixed(1)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {step === 2 && (
        <ul className="divide-y divide-zinc-800/70 overflow-hidden rounded-lg border border-zinc-800">
          {services.isLoading ? (
            <li className="p-4"><SkeletonRows rows={3} columns={3} /></li>
          ) : availableServices.length === 0 ? (
            <li className="bg-zinc-950 p-8 text-center text-xs text-zinc-500">Bu personel için hizmet tanımlı değil.</li>
          ) : availableServices.map((service) => (
            <li key={service.id}>
              <button
                type="button"
                aria-pressed={serviceIds.includes(service.id)}
                disabled={!serviceIds.includes(service.id) && serviceIds.length >= 10}
                onClick={() => toggleService(service.id)}
                className={`flex w-full items-center justify-between gap-3 p-4 text-left ${
                  serviceIds.includes(service.id) ? "bg-zinc-800/60" : "bg-zinc-950 hover:bg-zinc-900/60 disabled:cursor-not-allowed disabled:opacity-40"
                }`}
              >
                <span>
                  <span className="block text-xs text-zinc-100">{service.name}</span>
                  <span className="mt-0.5 block text-[11px] text-zinc-500">{service.category} · {service.durationMinutes} dk</span>
                </span>
                <span className="text-right">
                  <span className="block text-xs text-zinc-200">{service.price.toLocaleString("tr-TR")} ₺</span>
                  {serviceIds.includes(service.id) && <span className="mt-1 block text-[10px] text-lime-300">Sepette · kaldırmak için tıklayın</span>}
                </span>
              </button>
            </li>
          ))}
          {availableServices.length > 0 && (
            <li className="flex flex-wrap items-center justify-between gap-3 bg-zinc-950 p-4">
              <span className="text-xs text-zinc-400">
                Seçilen Hizmetler: {serviceIds.length} · {totalDuration} dk · {basePrice.toLocaleString("tr-TR")} ₺
                {serviceIds.length >= 10 && <span className="ml-2 text-amber-300">Maksimum hizmet sayısına ulaşıldı.</span>}
              </span>
              <button
                type="button"
                disabled={!serviceIds.length}
                onClick={() => { setSlot(null); setStep(3); }}
                className="rounded-md bg-lime-400 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-lime-300 disabled:opacity-40"
              >
                Randevuya devam et
              </button>
            </li>
          )}
        </ul>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <FormFieldset className="space-y-4">
          <FormField label="Tarih" description="Uygunluk kontrolü için randevu gününü seçin.">
            <FormInput
              type="date"
              value={date}
              min={todayIso()}
              onChange={(event) => { setDate(event.target.value); setSlot(null); }}
              className="h-9 sm:w-56"
            />
          </FormField>
          <ErrorAlert message={slots.error} onRetry={slots.refresh} />
          {slots.isLoading ? (
            <SkeletonRows rows={2} columns={5} />
          ) : (slots.data ?? []).length === 0 ? (
            <p className="rounded-lg border border-zinc-800 bg-zinc-950 p-8 text-center text-xs text-zinc-500">
              Seçilen tarihte uygun saat bulunmuyor.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
              {(slots.data ?? []).map((option) => {
                const time = new Date(option.startsAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
                const disabled = !option.isAvailable;
                return (
                  <button
                    key={option.startsAt}
                    type="button"
                    disabled={disabled}
                    onClick={() => { setSlot(option); setStep(4); }}
                    className={`rounded-md border px-3 py-2 text-xs ${
                      disabled
                        ? "cursor-not-allowed border-zinc-800 text-zinc-700 line-through"
                        : slot?.startsAt === option.startsAt
                          ? "border-zinc-600 bg-zinc-800 text-zinc-100"
                          : "border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700"
                    }`}
                  >
                    {time}
                  </button>
                );
              })}
            </div>
          )}
          </FormFieldset>
        </div>
      )}

      {step === 4 && selectedStaff && selectedServices.length > 0 && slot && (
        <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-sm font-semibold text-zinc-100">Randevu seçimleriniz hazır</h2>
          <dl className="space-y-3 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">Dükkan</dt>
              <dd className="text-right text-zinc-200">{shop.data?.name}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">Personel</dt>
              <dd className="text-right text-zinc-200">{selectedStaff.firstName} {selectedStaff.lastName} · {selectedStaff.title}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">Hizmetler</dt>
              <dd className="text-right text-zinc-200">{selectedServices.map((service) => service.name).join(", ")}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">Tarih / Saat</dt>
              <dd className="text-right text-zinc-200">
                {new Date(slot.startsAt).toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" })}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">Toplam süre</dt>
              <dd className="text-right text-zinc-200">{totalDuration} dakika</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2 border-t border-zinc-800 pt-4">
            <button type="button" onClick={() => setStep(3)} className="rounded-md border border-zinc-800 px-4 py-2.5 text-xs text-zinc-300 hover:bg-zinc-900">
              Saat seçimine dön
            </button>
            <button
              type="button"
              onClick={continueToCheckout}
              className="rounded-md bg-lime-400 px-4 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-lime-300"
            >
              Özet ve ödeme sayfasına geç
            </button>
          </div>
        </section>
      )}
    </section>
  );
}
