"use client";

import { useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { shopApi } from "@/lib/services";
import { useApiMutation, useApiQuery } from "@/lib/use-api";

export function useFavorites() {
  const { user, status, requestCustomerAccess } = useAuth();
  const isCustomer = status === "authenticated" && user?.role === "customer";
  const query = useApiQuery<string[]>(["/user/favorites", user?.id ?? "guest"], { enabled: isCustomer, list: true });
  const mutation = useApiMutation<{ shopId: string; isFavorite: boolean }, { shopId: string; isFavorite: boolean }>(
    ({ shopId, isFavorite }) => isFavorite ? shopApi.unfavorite(shopId) : shopApi.favorite(shopId),
  );
  const [overrides, setOverrides] = useState<{ userId: string | null; values: Record<string, boolean> }>({
    userId: user?.id ?? null,
    values: {},
  });
  const [pendingShopId, setPendingShopId] = useState<string | null>(null);

  const has = (shopId: string) => (
    (overrides.userId === user?.id ? overrides.values[shopId] : undefined)
      ?? (query.data ?? []).includes(shopId)
  );

  const toggle = async (shopId: string) => {
    if (!requestCustomerAccess("dükkanı favorilerinize eklemek", window.location.pathname + window.location.search)) return;
    if (!isCustomer || pendingShopId) return;

    const wasFavorite = has(shopId);
    setPendingShopId(shopId);
    try {
      const result = await mutation.run({ shopId, isFavorite: wasFavorite });
      if (result) {
        setOverrides((current) => ({
          userId: user?.id ?? null,
          values: { ...(current.userId === user?.id ? current.values : {}), [shopId]: result.isFavorite },
        }));
        query.refresh();
      }
    } finally {
      setPendingShopId(null);
    }
  };

  return {
    has,
    toggle,
    pendingShopId,
    error: query.error || mutation.error,
  };
}
