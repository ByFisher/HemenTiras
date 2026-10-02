"use client";

import { useAuth } from "@/components/providers/auth-provider";
import { useFavorites } from "@/components/user/use-favorites";
import { ErrorAlert, EmptyState } from "@/components/feedback/Skeleton";
import { ShopCard } from "@/components/user/ShopCard";
import type { Shop } from "@/types/api";

export function ShopGrid({ shops, isLoading = false }: { shops: Shop[]; isLoading?: boolean }) {
  const { status } = useAuth();
  const favorites = useFavorites();

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" aria-label="Dükkanlar yükleniyor">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="animate-pulse overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
            <div className="aspect-[1.8/1] bg-zinc-900" />
            <div className="space-y-3 p-4">
              <div className="h-4 w-2/3 rounded bg-zinc-900" />
              <div className="h-3 w-full rounded bg-zinc-900" />
              <div className="h-3 w-1/2 rounded bg-zinc-900" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (shops.length === 0) {
    return <EmptyState message="Aramanıza uygun dükkan bulunamadı. Filtreleri değiştirmeyi deneyin." />;
  }

  return (
    <>
      {favorites.error && <ErrorAlert message={favorites.error} />}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {shops.map((shop) => (
          <ShopCard
            key={shop.id}
            shop={shop}
            isFavorite={favorites.has(shop.id)}
            favoritePending={status === "loading" || favorites.pendingShopId === shop.id}
            onFavorite={() => void favorites.toggle(shop.id)}
          />
        ))}
      </div>
    </>
  );
}
