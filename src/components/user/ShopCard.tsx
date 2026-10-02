"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock3, MapPin, Star } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import type { Shop } from "@/types/api";
import { FavoriteButton } from "@/components/user/FavoriteButton";

function todayHours(shop: Shop) {
  const today = shop.workingHours.find((hours) => hours.dayOfWeek === new Date().getDay());
  if (!today || today.isClosed || !today.opensAt || !today.closesAt) return "Bugün kapalı";
  return `${today.opensAt} - ${today.closesAt}`;
}

export function ShopCard({
  shop,
  isFavorite = false,
  favoritePending = false,
  onFavorite,
}: {
  shop: Shop;
  isFavorite?: boolean;
  favoritePending?: boolean;
  onFavorite?: () => void;
}) {
  const router = useRouter();
  const { status, requestCustomerAccess } = useAuth();
  const detailHref = `/dukkan/${encodeURIComponent(shop.slug || shop.id)}`;
  const featured = shop.averageRating >= 4.5 && shop.reviewCount > 0;

  const startBooking = () => {
    if (status === "loading") return;
    const bookingHref = `/book/${shop.id}`;
    if (requestCustomerAccess("randevu almak", bookingHref)) router.push(bookingHref);
  };

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 transition duration-200 hover:-translate-y-0.5 hover:border-zinc-500 hover:shadow-[0_18px_45px_rgba(0,0,0,0.24)]">
      <Link href={detailHref} aria-label={`${shop.name} dükkan detaylarını görüntüle`} className="absolute inset-0 z-0 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" />

      <div className="pointer-events-none relative z-[1]">
        <div className="relative aspect-[1.8/1] overflow-hidden bg-zinc-900">
          {shop.coverImageUrl || shop.profileImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shop.coverImageUrl || shop.profileImageUrl || ""}
              alt={`${shop.name} salon görseli`}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.08),transparent_60%),linear-gradient(145deg,#18181b,#09090b)]">
              <span className="text-3xl font-semibold tracking-tight text-white/10">{shop.name.slice(0, 1).toLocaleUpperCase("tr-TR")}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" />
          {featured && (
            <span className="absolute bottom-3 right-3 rounded-full border border-white/15 bg-zinc-950/85 px-2.5 py-1 text-[10px] font-medium text-zinc-100 backdrop-blur">
              Öne çıkan
            </span>
          )}
          {onFavorite && (
            <div className="pointer-events-auto absolute right-3 top-3">
              <FavoriteButton isFavorite={isFavorite} isPending={favoritePending} onClick={onFavorite} />
            </div>
          )}
        </div>

        <div className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="line-clamp-1 text-sm font-semibold text-zinc-100 group-hover:text-white">{shop.name}</h2>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-400/15 bg-amber-400/[0.07] px-2 py-1 text-[11px] font-semibold text-amber-200">
              <Star size={12} className="fill-amber-300 text-amber-300" />
              {shop.reviewCount > 0 ? shop.averageRating.toFixed(1) : "Yeni"}
              {shop.reviewCount > 0 && (
                <span className="font-normal text-amber-100/60">({shop.reviewCount > 120 ? "120+" : shop.reviewCount})</span>
              )}
            </span>
          </div>

          <div className="flex min-h-6 flex-wrap gap-1.5">
            {(shop.services ?? []).slice(0, 3).map((service) => (
              <span key={service.id} className="rounded-full border border-zinc-800 bg-zinc-900 px-2 py-1 text-[10px] text-zinc-400">
                {service.name}
              </span>
            ))}
            {(shop.services ?? []).length === 0 && (
              <span className="text-[10px] text-zinc-600">Hizmet bilgisi yakında</span>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800/80 pt-3 text-[11px] text-zinc-500">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <MapPin size={12} className="shrink-0 text-zinc-300" />
              <span className="truncate">{shop.address.district.city.name}, {shop.address.district.name}</span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1.5">
              <Clock3 size={12} />
              {todayHours(shop)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-zinc-500">
              {shop.minimumServicePrice !== null && shop.minimumServicePrice !== undefined
                ? <>Başlangıç: <span className="font-medium text-zinc-200">{shop.minimumServicePrice.toLocaleString("tr-TR")} ₺</span></>
                : "Fiyat bilgisi yok"}
            </p>
            <span className="text-[10px] text-zinc-600">Detayları gör →</span>
          </div>
        </div>
      </div>

      <div className="pointer-events-auto absolute bottom-3 right-3 z-10">
        <button
          type="button"
          disabled={status === "loading"}
          onClick={startBooking}
          className="rounded-lg bg-white px-3 py-2 text-[11px] font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:opacity-50"
        >
          Randevu al
        </button>
      </div>
    </article>
  );
}
