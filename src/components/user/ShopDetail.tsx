"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, Clock, MapPin, Phone, ShoppingBag, Star } from "lucide-react";
import { useApiQuery } from "@/lib/use-api";
import { ErrorAlert, Skeleton, SkeletonRows } from "@/components/feedback/Skeleton";
import type { Service, Shop, Staff, StaffReview } from "@/types/api";
import { useAuth } from "@/components/providers/auth-provider";
import { FavoriteButton } from "@/components/user/FavoriteButton";
import { useFavorites } from "@/components/user/use-favorites";

const DAY_LABELS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

function RatingBadge({ value, count }: { value: number; count: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-amber-300">
      <Star size={12} className="fill-amber-400 text-amber-400" />
      {value.toFixed(1)}
      <span className="text-zinc-600">({count})</span>
    </span>
  );
}

export function ShopDetail({ shopId, bySlug = false }: { shopId: string; bySlug?: boolean }) {
  const router = useRouter();
  const [activeStaffId, setActiveStaffId] = useState<string | null>(null);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [cartToast, setCartToast] = useState("");
  const cartToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { requestCustomerAccess, status: authStatus } = useAuth();
  const favorites = useFavorites();

  useEffect(() => () => {
    if (cartToastTimer.current) clearTimeout(cartToastTimer.current);
  }, []);

  const shop = useApiQuery<Shop>(
    bySlug ? ["/shops/slug/:slug", shopId] : ["/shops/:id", shopId],
    { query: {} },
  );
  const detailShopId = shop.data?.id ?? (bySlug ? "" : shopId);
  const services = useApiQuery<Service[]>(["/shops/:id/services", detailShopId], { enabled: Boolean(detailShopId), list: true });
  const staff = useApiQuery<Staff[]>(["/shops/:id/staff", detailShopId], { enabled: Boolean(detailShopId), list: true });
  const reviews = useApiQuery<StaffReview[]>(
    ["/shops/:id/staff/:staffId/reviews", detailShopId, activeStaffId],
    { enabled: Boolean(detailShopId && activeStaffId), list: true, query: { staff_id: activeStaffId ?? undefined } },
  );

  if (shop.isLoading) {
    return (
      <section className="space-y-4">
        <Skeleton className="aspect-3/1 w-full" />
        <Skeleton className="h-6 w-1/3" />
        <SkeletonRows rows={4} columns={3} />
      </section>
    );
  }

  if (shop.error || !shop.data) {
    return <ErrorAlert message={shop.error || "Dükkan bilgisi alınamadı."} onRetry={shop.refresh} />;
  }

  const detail = shop.data;
  const visibleStaff = (staff.data ?? []).filter((member) => member.isApproved);
  const startBooking = (staffId?: string, serviceIds: string[] = []) => {
    const query = new URLSearchParams();
    if (staffId) query.set("staffId", staffId);
    if (serviceIds.length) query.set("serviceIds", serviceIds.join(","));
    const bookingPath = `/book/${detail.id}${query.size ? `?${query.toString()}` : ""}`;
    if (requestCustomerAccess("randevu almak", bookingPath)) router.push(bookingPath);
  };
  const toggleCartService = (service: Service) => {
    const isSelected = selectedServiceIds.includes(service.id);
    setSelectedServiceIds((current) => isSelected
      ? current.filter((id) => id !== service.id)
      : [...current, service.id].slice(0, 10));
    setCartToast(isSelected ? `${service.name} sepetten çıkarıldı.` : `${service.name} hizmet sepete eklendi.`);
    if (cartToastTimer.current) clearTimeout(cartToastTimer.current);
    cartToastTimer.current = setTimeout(() => setCartToast(""), 3200);
  };
  const selectedServices = (services.data ?? []).filter((service) => selectedServiceIds.includes(service.id));
  const selectedPrice = selectedServices.reduce((total, service) => total + service.price, 0);

  return (
    <section className={`space-y-6 ${selectedServices.length > 0 ? "pb-28 sm:pb-24" : ""}`}>
      <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
        {detail.coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={detail.coverImageUrl} alt={`${detail.name} kapak görseli`} className="aspect-3/1 w-full object-cover" />
        )}
        <div className="space-y-3 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">{detail.name}</h1>
              <p className="mt-1 text-xs text-zinc-500">{detail.description}</p>
            </div>
            <div className="space-y-1 text-right">
              <RatingBadge value={detail.averageRating} count={detail.reviewCount} />
              <p className="flex items-center justify-end gap-1 text-[11px] text-zinc-500">
                <MapPin size={11} />
                {detail.address.fullAddress}
              </p>
              <p className="flex items-center justify-end gap-1 text-[11px] text-zinc-500">
                <Phone size={11} />
                {detail.phone}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={authStatus === "loading"}
              onClick={() => startBooking()}
              className="inline-flex h-9 items-center rounded-md bg-zinc-100 px-4 text-xs font-medium text-zinc-950 hover:bg-white disabled:opacity-50"
            >
              Randevu al
            </button>
            <div className="relative h-9 w-9">
              <FavoriteButton
                isFavorite={favorites.has(detail.id)}
                isPending={authStatus === "loading" || favorites.pendingShopId === detail.id}
                onClick={() => void favorites.toggle(detail.id)}
              />
            </div>
          </div>
          <ErrorAlert message={favorites.error} />
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-200">Çalışma Saatleri</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {detail.workingHours.map((hour) => (
            <div key={hour.dayOfWeek} className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">
              <span className="text-zinc-400">{DAY_LABELS[hour.dayOfWeek]}</span>
              <span className="flex items-center gap-1 text-zinc-300">
                <Clock size={11} className="text-zinc-600" />
                {hour.isClosed || !hour.opensAt ? "Kapalı" : `${hour.opensAt} – ${hour.closesAt}`}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-200">Hizmetler</h2>
        <ErrorAlert message={services.error} onRetry={services.refresh} />
        {services.isLoading ? (
          <SkeletonRows rows={3} columns={4} />
        ) : (
          <div className="overflow-hidden rounded-lg border border-zinc-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900/60 text-zinc-500">
                <tr>
                  <th className="px-3 py-3 font-medium">Hizmet</th>
                  <th className="px-3 py-3 font-medium">Kategori</th>
                  <th className="px-3 py-3 font-medium">Süre</th>
                  <th className="px-3 py-3 text-right font-medium">Fiyat</th>
                  <th className="px-3 py-3 text-right font-medium">Sepet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70 bg-zinc-950">
                {(services.data ?? []).map((service) => (
                  <tr key={service.id}>
                    <td className="px-3 py-3 text-zinc-200">
                      {service.name}
                      {service.description && <p className="mt-0.5 text-[11px] text-zinc-600">{service.description}</p>}
                    </td>
                    <td className="px-3 py-3 text-zinc-400">{service.category}</td>
                    <td className="px-3 py-3 text-zinc-400">{service.durationMinutes} dk</td>
                    <td className="px-3 py-3 text-right text-zinc-200">{service.price.toLocaleString("tr-TR")} ₺</td>
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        aria-pressed={selectedServiceIds.includes(service.id)}
                        onClick={() => toggleCartService(service)}
                        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] ${
                          selectedServiceIds.includes(service.id)
                            ? "border-lime-800 bg-lime-950/30 text-lime-300"
                            : "border-zinc-700 text-zinc-200 hover:border-lime-700 hover:text-lime-300"
                        }`}
                      >
                        {selectedServiceIds.includes(service.id) ? <><Check size={12} /> Sepette</> : "Sepete ekle"}
                      </button>
                    </td>
                  </tr>
                ))}
                {(services.data ?? []).length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-zinc-600">Listelenebilir hizmet yok.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-200">Personeller</h2>
        <ErrorAlert message={staff.error} onRetry={staff.refresh} />
        {staff.isLoading ? (
          <SkeletonRows rows={3} columns={4} />
        ) : visibleStaff.length === 0 ? (
          <p className="rounded-lg border border-zinc-800 bg-zinc-950 p-8 text-center text-xs text-zinc-500">
            Onaylanmış personel bulunmuyor.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visibleStaff.map((member) => (
              <li key={member.id} className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                <div className="flex items-center gap-3">
                  {member.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={member.photoUrl} alt={`${member.firstName} ${member.lastName}`} className="h-12 w-12 rounded-full object-cover" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-zinc-100">{member.firstName} {member.lastName}</p>
                    <p className="text-[11px] text-zinc-500">{member.title} · {member.experienceYears} yıl</p>
                    <RatingBadge value={member.averageRating} count={member.reviewCount} />
                  </div>
                </div>
                <p className="text-[11px] leading-relaxed text-zinc-400">{member.biography}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveStaffId(activeStaffId === member.id ? null : member.id)}
                    className="rounded border border-zinc-800 px-2.5 py-1.5 text-[11px] text-zinc-300 hover:bg-zinc-900"
                  >
                    {activeStaffId === member.id ? "Yorumları gizle" : `Yorumlar (${member.reviewCount})`}
                  </button>
                  <button
                    type="button"
                    disabled={authStatus === "loading"}
                    onClick={() => startBooking(member.id)}
                    className="rounded bg-zinc-100 px-2.5 py-1.5 text-[11px] font-medium text-zinc-950 hover:bg-white disabled:opacity-50"
                  >
                    Randevu al
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {activeStaffId && (
        <section className="space-y-3">
          <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">Müşteri yorumları</h3>
          <ErrorAlert message={reviews.error} onRetry={reviews.refresh} />
          {reviews.isLoading ? (
            <SkeletonRows rows={2} columns={2} />
          ) : (reviews.data ?? []).length === 0 ? (
            <p className="rounded-lg border border-zinc-800 bg-zinc-950 p-6 text-center text-xs text-zinc-600">Bu personel için henüz yorum yok.</p>
          ) : (
            <ul className="space-y-2">
              {(reviews.data ?? []).map((review) => (
                <li key={review.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">
                      {review.customer?.firstName} {review.customer?.maskedSurname}
                    </span>
                    <RatingBadge value={review.rating} count={1} />
                  </div>
                  {review.comment && <p className="mt-2 leading-relaxed text-zinc-300">{review.comment}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {cartToast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed ${selectedServices.length ? "bottom-24" : "bottom-5"} right-4 z-[100] flex max-w-sm items-center gap-2 rounded-lg border border-emerald-800 bg-zinc-950 px-4 py-3 text-xs text-emerald-300 shadow-2xl sm:right-6`}
        >
          <Check size={14} aria-hidden="true" />
          {cartToast}
        </div>
      )}
      {selectedServices.length > 0 && (
        <aside className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-700 bg-zinc-950/95 shadow-[0_-12px_40px_rgba(0,0,0,0.4)] backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-zinc-100">
                {selectedServices.length} Hizmet Seçildi
                <span className="mx-1.5 text-zinc-600">|</span>
                Toplam: {selectedPrice.toLocaleString("tr-TR")} ₺
              </p>
              <p className="mt-1 truncate text-[11px] text-zinc-500">
                <ShoppingBag size={12} className="mr-1 inline" aria-hidden="true" />
                {selectedServices.map((service) => service.name).join(", ")}
              </p>
            </div>
            <button
              type="button"
              disabled={authStatus === "loading"}
              onClick={() => {
                const query = new URLSearchParams({
                  shopId: detail.id,
                  serviceIds: selectedServiceIds.join(","),
                });
                const checkoutPath = `/checkout?${query.toString()}`;
                if (requestCustomerAccess("randevu almak", checkoutPath)) router.push(checkoutPath);
              }}
              className="shrink-0 rounded-lg bg-lime-400 px-4 py-3 text-xs font-semibold text-zinc-950 shadow-sm transition hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Ödemeye Geç ({selectedServices.length} Hizmet)
            </button>
          </div>
        </aside>
      )}
    </section>
  );
}
