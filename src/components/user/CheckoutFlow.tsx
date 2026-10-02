"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Banknote, Check, CreditCard, Store, Trash2 } from "lucide-react";
import { Description, Label, Radio, RadioGroup } from "@headlessui/react";
import { appointmentApi, couponApi } from "@/lib/services";
import { useApiMutation, useApiQuery } from "@/lib/use-api";
import { ErrorAlert, SkeletonRows } from "@/components/feedback/Skeleton";
import type {
  Appointment,
  AppointmentSlot,
  CouponQuote,
  CreateAppointmentInput,
  Service,
  Shop,
  Staff,
} from "@/types/api";
import { FormField, FormInput, FormTextarea } from "@/components/ui/form";

type PaymentMethod = "card" | "at_shop_card" | "cash";

const PAYMENT_METHODS: {
  value: PaymentMethod;
  title: string;
  description: string;
  Icon: typeof CreditCard;
}[] = [
  {
    value: "card",
    title: "Kredi / banka kartı",
    description: "Ödeme, sağlayıcının güvenli ödeme sayfasında tamamlanır.",
    Icon: CreditCard,
  },
  {
    value: "at_shop_card",
    title: "Dükkanda kartla öde",
    description: "Kartınızdan şimdi tahsilat yapılmaz.",
    Icon: Store,
  },
  {
    value: "cash",
    title: "Dükkanda nakit öde",
    description: "Ödemeyi randevunuz sırasında nakit yapın.",
    Icon: Banknote,
  },
];

const formatMoney = (amount: number) => `${amount.toLocaleString("tr-TR")} ₺`;

export function CheckoutFlow({
  shopId,
  staffId: initialStaffId,
  serviceIds: initialServiceIds,
  startsAt: initialStartsAt,
}: {
  shopId: string;
  staffId?: string;
  serviceIds: string[];
  startsAt?: string;
}) {
  const router = useRouter();
  const [serviceIds, setServiceIds] = useState(initialServiceIds);
  const [staffId, setStaffId] = useState(initialStaffId ?? "");
  const [date, setDate] = useState(initialStartsAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [startsAt, setStartsAt] = useState(initialStartsAt ?? "");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [couponCode, setCouponCode] = useState("");
  const [couponQuote, setCouponQuote] = useState<CouponQuote | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [preInformationAccepted, setPreInformationAccepted] = useState(false);
  const [distanceSalesAccepted, setDistanceSalesAccepted] = useState(false);
  const [note, setNote] = useState("");
  const [identityNumber, setIdentityNumber] = useState("");
  const [registrationAddress, setRegistrationAddress] = useState("");
  const [createdAppointment, setCreatedAppointment] = useState<Appointment | null>(null);

  const shop = useApiQuery<Shop>(["/shops/:id", shopId]);
  const staffQuery = useApiQuery<Staff[]>(["/shops/:id/staff", shopId], { list: true });
  const servicesQuery = useApiQuery<Service[]>(["/shops/:id/services", shopId], { list: true });
  const slotsQuery = useApiQuery<AppointmentSlot[]>(
    ["/shops/:id/staff/:staffId/availability", shopId, staffId, serviceIds.join(","), date],
    {
      enabled: Boolean(staffId && serviceIds.length && date),
      list: true,
      query: { service_ids: serviceIds.join(","), date },
    },
  );
  const createAppointment = useApiMutation<CreateAppointmentInput, Appointment>(appointmentApi.create);
  const validateCoupon = useApiMutation<{ shopId: string; code: string; basketAmount: number }, CouponQuote>(couponApi.validate);
  const startCheckout = useApiMutation<
    { appointmentId: string; identityNumber: string; registrationAddress: string },
    { checkoutUrl: string }
  >(({ appointmentId, identityNumber: identity, registrationAddress: address }) =>
    appointmentApi.startIyzicoCheckout(appointmentId, identity, address),
  );

  const selectedStaff = useMemo(
    () => (staffQuery.data ?? []).find((member) => member.id === staffId && member.isApproved) ?? null,
    [staffQuery.data, staffId],
  );
  const selectedServices = useMemo(
    () => serviceIds.flatMap((id) => (servicesQuery.data ?? []).filter((service) => service.id === id)),
    [serviceIds, servicesQuery.data],
  );
  const basePrice = selectedServices.reduce((sum, service) => sum + service.price, 0);
  const totalDuration = selectedServices.reduce((sum, service) => sum + service.durationMinutes, 0);
  const selectedSlotIsAvailable = (slotsQuery.data ?? []).some((slot) => slot.startsAt === startsAt && slot.isAvailable);
  const hasInvalidSelection = !shopId || serviceIds.length === 0
    || (servicesQuery.data !== undefined && selectedServices.length !== serviceIds.length);

  const removeService = (serviceId: string) => {
    setServiceIds((current) => current.filter((id) => id !== serviceId));
    setStartsAt("");
    setCouponQuote(null);
    setAppliedCoupon("");
    setCouponCode("");
    validateCoupon.reset();
  };

  const selectStaff = (nextStaffId: string) => {
    setStaffId(nextStaffId);
    setStartsAt("");
  };

  const selectDate = (nextDate: string) => {
    setDate(nextDate);
    setStartsAt("");
  };

  const applyCoupon = async () => {
    const quote = await validateCoupon.run({
      shopId,
      code: couponCode.trim(),
      basketAmount: basePrice,
    });
    if (quote) {
      setCouponQuote(quote);
      setAppliedCoupon(quote.code);
    }
  };

  const completeOrder = async () => {
    let appointment = createdAppointment;
    if (!appointment) {
      appointment = await createAppointment.run({
        shopId,
        staffId,
        serviceIds,
        startsAt,
        note: note.trim() || undefined,
        couponCode: appliedCoupon || undefined,
        paymentMethod,
      }) ?? null;
      if (!appointment) return;
      setCreatedAppointment(appointment);
    }

    if (paymentMethod === "card") {
      if (appointment.demoPaymentEnabled) {
        router.push(`/demo-iyzico/${encodeURIComponent(appointment.id)}`);
        return;
      }
      const checkout = await startCheckout.run({
        appointmentId: appointment.id,
        identityNumber,
        registrationAddress: registrationAddress.trim(),
      });
      if (checkout) window.location.assign(checkout.checkoutUrl);
      return;
    }

    router.push("/my-appointments?created=1");
  };

  const isSubmitting = createAppointment.isPending || startCheckout.isPending;
  const canComplete = paymentMethod !== "card"
    || (identityNumber.length === 11 && registrationAddress.trim().length >= 5);

  if (hasInvalidSelection) {
    return (
      <section className="mx-auto max-w-xl space-y-4 rounded-xl border border-zinc-800 bg-zinc-950 p-6">
        <h1 className="text-base font-semibold text-zinc-100">Ödeme özeti açılamadı</h1>
        <p className="text-sm leading-6 text-zinc-400">Hizmet bilgisi eksik veya artık geçerli değil. Lütfen dükkan sayfasından hizmetlerinizi yeniden seçin.</p>
        <Link href={`/shops/${encodeURIComponent(shopId)}`} className="inline-flex rounded-md bg-lime-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-lime-300">
          Dükkan sayfasına dön
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <Link href={`/shops/${encodeURIComponent(shopId)}`} className="text-xs text-zinc-500 hover:text-zinc-200">
          ← Dükkan sayfasına dön
        </Link>
        <h1 className="pt-2 text-xl font-semibold tracking-tight text-zinc-100">Ödeme ve randevu özeti</h1>
        <p className="text-sm text-zinc-500">Hizmetleri ve ödeme yönteminizi kontrol ederek randevunuzu tamamlayın.</p>
      </header>

      <ErrorAlert
        message={shop.error || staffQuery.error || servicesQuery.error || slotsQuery.error}
        onRetry={() => { shop.refresh(); staffQuery.refresh(); servicesQuery.refresh(); slotsQuery.refresh(); }}
      />

      {(shop.isLoading || staffQuery.isLoading || servicesQuery.isLoading) ? (
        <SkeletonRows rows={5} columns={2} />
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4 sm:p-5">
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">Personel ve randevu saati</h2>
                <p className="mt-1 text-xs text-zinc-500">Ödeme öncesinde hizmetlerinize uygun personel ve boş bir saat seçin.</p>
              </div>
              {staffQuery.isLoading ? (
                <SkeletonRows rows={2} columns={2} />
              ) : (staffQuery.data ?? []).filter((member) => member.isApproved).length === 0 ? (
                <p className="rounded-md border border-zinc-800 p-3 text-xs text-zinc-500">Bu dükkanda onaylı personel bulunmuyor.</p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {(staffQuery.data ?? []).filter((member) => member.isApproved).map((member) => {
                    const allowedServices = member.services.length === 0
                      || serviceIds.every((id) => member.services.some((service) => service.id === id));
                    return (
                      <li key={member.id}>
                        <button
                          type="button"
                          disabled={!allowedServices || Boolean(createdAppointment)}
                          aria-pressed={staffId === member.id}
                          onClick={() => selectStaff(member.id)}
                          className={`w-full rounded-lg border p-3 text-left text-xs transition disabled:cursor-not-allowed disabled:opacity-40 ${
                            staffId === member.id
                              ? "border-lime-700 bg-lime-950/20 text-lime-200"
                              : "border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:border-zinc-700"
                          }`}
                        >
                          <span className="block font-medium">{member.firstName} {member.lastName}</span>
                          <span className="mt-1 block text-zinc-500">
                            {member.title}{allowedServices ? "" : " · seçili hizmetlerin tamamını sunmuyor"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {staffId && (
                <div className="space-y-3 border-t border-zinc-800 pt-4">
                  <FormField label="Randevu tarihi" description="Uygun saatler seçtiğiniz personel ve hizmetlere göre listelenir.">
                    <FormInput
                      type="date"
                      value={date}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={(event) => selectDate(event.target.value)}
                      disabled={Boolean(createdAppointment)}
                      className="h-10 sm:max-w-xs"
                    />
                  </FormField>
                  <p className="text-xs text-zinc-500">Uygun saatler</p>
                  {slotsQuery.isLoading ? (
                    <SkeletonRows rows={1} columns={5} />
                  ) : (slotsQuery.data ?? []).filter((slot) => slot.isAvailable).length === 0 ? (
                    <p className="rounded-md border border-zinc-800 p-3 text-xs text-zinc-500">Bu tarihte uygun saat bulunmuyor.</p>
                  ) : (
                    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {(slotsQuery.data ?? []).filter((slot) => slot.isAvailable).map((slot) => (
                        <li key={slot.startsAt}>
                          <button
                            type="button"
                            disabled={Boolean(createdAppointment)}
                            aria-pressed={startsAt === slot.startsAt}
                            onClick={() => setStartsAt(slot.startsAt)}
                            className={`w-full rounded-md border px-2 py-2 text-xs ${
                              startsAt === slot.startsAt
                                ? "border-lime-700 bg-lime-950/30 text-lime-200"
                                : "border-zinc-800 text-zinc-300 hover:border-zinc-600"
                            }`}
                          >
                            {new Date(slot.startsAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-800 pb-4">
                <div>
                  <p className="text-base font-semibold text-zinc-100">{shop.data?.name ?? "Dükkan"}</p>
                  <p className="mt-1 text-sm text-zinc-400">
                    {selectedStaff ? `${selectedStaff.firstName} ${selectedStaff.lastName} · ${selectedStaff.title}` : "Personel seçin"}
                  </p>
                </div>
                <div className="text-right text-xs text-zinc-400">
                  <p>{startsAt ? new Date(startsAt).toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" }) : "Saat seçilmedi"}</p>
                  <p className="mt-1">Toplam süre: {totalDuration} dakika</p>
                </div>
              </div>

              <ul className="divide-y divide-zinc-800">
                {selectedServices.map((service) => (
                  <li key={service.id} className="flex items-center justify-between gap-3 py-4 first:pt-4 last:pb-1">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-100">{service.name}</p>
                      <p className="mt-1 text-xs text-zinc-500">{service.category} · {service.durationMinutes} dk</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-medium text-zinc-200">{formatMoney(service.price)}</span>
                      <button
                        type="button"
                        aria-label={`${service.name} hizmetini sepetten çıkar`}
                        onClick={() => removeService(service.id)}
                        disabled={Boolean(createdAppointment)}
                        className="rounded-md p-2 text-zinc-500 hover:bg-zinc-900 hover:text-rose-300 disabled:opacity-40"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </li>
                ))}
                {selectedServices.length === 0 && (
                  <li className="py-6 text-center text-sm text-zinc-500">Sepetinizde hizmet kalmadı.</li>
                )}
              </ul>
            </section>

            <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4 sm:p-5">
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">Ödeme yöntemi</h2>
                <p className="mt-1 text-xs text-zinc-500">Kart bilgilerinizi bu sayfaya girmeyin; kartla ödeme güvenli ödeme sağlayıcısında açılır.</p>
              </div>
              <RadioGroup value={paymentMethod} onChange={(value: PaymentMethod) => setPaymentMethod(value)} className="grid gap-2">
                <Label className="sr-only">Ödeme yöntemi</Label>
                {PAYMENT_METHODS.map(({ value, title, description, Icon }) => (
                  <Radio
                    key={value}
                    value={value}
                    disabled={Boolean(createdAppointment)}
                    className="group flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 outline-none transition data-[checked]:border-lime-700 data-[checked]:bg-lime-950/20 data-[focus]:ring-2 data-[focus]:ring-lime-500 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
                  >
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-zinc-600 text-transparent group-data-[checked]:border-lime-400 group-data-[checked]:text-lime-300">
                      <Check size={12} aria-hidden="true" />
                    </span>
                    <Icon size={18} className="mt-0.5 shrink-0 text-zinc-400 group-data-[checked]:text-lime-300" aria-hidden="true" />
                    <span>
                      <Label className="block text-sm font-medium text-zinc-100">{title}</Label>
                      <Description className="mt-1 block text-xs leading-relaxed text-zinc-500">{description}</Description>
                    </span>
                  </Radio>
                ))}
              </RadioGroup>

              {paymentMethod === "card" && (
                <div className="grid gap-3 border-t border-zinc-800 pt-4 sm:grid-cols-2">
                  <FormField label="T.C. kimlik numarası" description="Ödeme sağlayıcısının doğrulaması için gereklidir.">
                    <FormInput
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={11}
                      value={identityNumber}
                      onChange={(event) => setIdentityNumber(event.target.value.replace(/\D/g, ""))}
                      aria-invalid={identityNumber.length > 0 && identityNumber.length !== 11}
                    />
                  </FormField>
                  <FormField label="Fatura adresi" description="Yalnızca güvenli ödeme isteğinde kullanılır.">
                    <FormTextarea
                      value={registrationAddress}
                      onChange={(event) => setRegistrationAddress(event.target.value)}
                      maxLength={500}
                      rows={2}
                      className="min-h-20"
                    />
                  </FormField>
                  <p className="sm:col-span-2 text-[11px] leading-relaxed text-zinc-500">
                    Kart numarası, son kullanma tarihi ve CVC bu uygulamada alınmaz veya saklanmaz. Ödeme, iyzico’nun ya da etkin demo sağlayıcısının güvenli ekranında tamamlanır.
                  </p>
                </div>
              )}
            </section>

            <FormField label="Randevu notu (isteğe bağlı)" description="Dükkanın bilmesini istediğiniz kısa not.">
              <FormTextarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={500}
                placeholder="Özel bir isteğiniz varsa yazın..."
                disabled={Boolean(createdAppointment)}
              />
            </FormField>
            <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4 sm:p-5">
              <h2 className="text-sm font-semibold text-zinc-100">Sözleşmeler ve onaylar</h2>
              <label className="flex items-start gap-3 text-xs leading-relaxed text-zinc-300">
                <input
                  type="checkbox"
                  checked={preInformationAccepted}
                  onChange={(event) => setPreInformationAccepted(event.target.checked)}
                  disabled={Boolean(createdAppointment)}
                  className="mt-0.5 size-4 accent-lime-400"
                />
                <span>Ön Bilgilendirme Formu’nu okudum ve onaylıyorum.</span>
              </label>
              <label className="flex items-start gap-3 text-xs leading-relaxed text-zinc-300">
                <input
                  type="checkbox"
                  checked={distanceSalesAccepted}
                  onChange={(event) => setDistanceSalesAccepted(event.target.checked)}
                  disabled={Boolean(createdAppointment)}
                  className="mt-0.5 size-4 accent-lime-400"
                />
                <span>Mesafeli Satış Sözleşmesi’ni okudum ve kabul ediyorum.</span>
              </label>
            </section>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-6">
            <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4 sm:p-5">
              <div>
                <h2 className="text-base font-semibold text-zinc-100">Sipariş özeti</h2>
                <p className="mt-1 text-xs text-zinc-500">{selectedServices.length} hizmet · {totalDuration} dakika</p>
              </div>

              <div className="flex gap-2">
                <FormInput
                  value={couponCode}
                  onChange={(event) => {
                    setCouponCode(event.target.value);
                    setCouponQuote(null);
                    setAppliedCoupon("");
                    validateCoupon.reset();
                  }}
                  maxLength={64}
                  placeholder="İndirim Kodu / Kupon Girin"
                  aria-label="İndirim kodu veya kupon girin"
                  disabled={Boolean(createdAppointment)}
                />
                <button
                  type="button"
                  onClick={() => void applyCoupon()}
                  disabled={couponCode.trim().length < 4 || validateCoupon.isPending || Boolean(createdAppointment)}
                  className="shrink-0 rounded-md border border-zinc-700 px-3 text-xs font-medium text-zinc-200 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {validateCoupon.isPending ? "Kontrol…" : "Uygula"}
                </button>
              </div>
              <ErrorAlert message={validateCoupon.error} />
              {appliedCoupon && (
                <p role="status" className="rounded-md border border-emerald-900 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-300">
                  {appliedCoupon} kuponu uygulandı.
                </p>
              )}

              <dl className="space-y-3 border-t border-zinc-800 pt-4 text-sm">
                <div className="flex justify-between gap-3 text-zinc-400">
                  <dt>Hizmetler toplamı (brüt)</dt>
                  <dd>{formatMoney(basePrice)}</dd>
                </div>
                <div className="flex justify-between gap-3 text-emerald-300">
                  <dt>Uygulanan indirim</dt>
                  <dd>{couponQuote ? `−${formatMoney(couponQuote.discountAmount)}` : formatMoney(0)}</dd>
                </div>
                <div className="flex justify-between gap-3 border-t border-zinc-800 pt-3 font-semibold text-zinc-100">
                  <dt>Toplam ödenecek</dt>
                  <dd>{formatMoney(couponQuote?.totalPrice ?? basePrice)}</dd>
                </div>
              </dl>

              <ErrorAlert message={createAppointment.error || startCheckout.error} />
              <button
                type="button"
                onClick={() => void completeOrder()}
                disabled={
                  !selectedServices.length
                  || !selectedStaff
                  || !selectedSlotIsAvailable
                  || !preInformationAccepted
                  || !distanceSalesAccepted
                  || isSubmitting
                  || !canComplete
                  || Boolean(createdAppointment && paymentMethod !== "card")
                }
                className="w-full rounded-lg bg-lime-400 px-4 py-3.5 text-sm font-semibold text-zinc-950 shadow-sm transition hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSubmitting
                  ? "İşleminiz hazırlanıyor…"
                  : createdAppointment
                    ? "Güvenli ödeme sayfasına geç"
                    : paymentMethod === "card"
                      ? "Ödemeyi tamamla ve randevuyu onayla"
                      : "Randevuyu oluştur"}
              </button>
              <p className="text-center text-[11px] leading-relaxed text-zinc-600">
                Kupon ve toplam tutar randevu oluşturulurken sunucuda yeniden doğrulanır.
              </p>
            </section>
            <Link href={`/shops/${encodeURIComponent(shopId)}`} className="block text-center text-xs text-zinc-500 hover:text-zinc-200">
              Dükkan bilgilerine dön
            </Link>
          </aside>
        </div>
      )}
    </section>
  );
}
