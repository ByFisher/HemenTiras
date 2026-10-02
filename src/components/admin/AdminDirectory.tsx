"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { ADMIN_ENTITY_PATH, adminApi, type AdminDirectoryFilters } from "@/lib/services";
import { useApiMutation, useApiQuery } from "@/lib/use-api";
import { ErrorAlert, EmptyState, SkeletonRows } from "@/components/feedback/Skeleton";
import type { MaskedUser, Paginated, Shop, Sponsor } from "@/types/api";
import { FormField, FormFieldset, FormInput, FormListbox } from "@/components/ui/form";

type View = keyof typeof ADMIN_ENTITY_PATH;

function listFromResponse<T>(response: T[] | Paginated<T> | undefined): T[] {
  if (!response) return [];
  return Array.isArray(response) ? response : response.data;
}

const VIEW_CONFIG: Record<View, { label: string; empty: string }> = {
  customers: { label: "Kullanıcılar (KVKK maskeli)", empty: "Kayıtlı kullanıcı yok." },
  shops: { label: "Dükkanlar", empty: "Kayıtlı dükkan yok." },
  sponsors: { label: "Sponsorlar", empty: "Kayıtlı sponsor yok." },
};

/** Süper Admin dizini: /admin/users, /admin/shops, /admin/sponsors uçlarından canlı veri. */
export function AdminDirectory({ view, initialStatus = "" }: { view: View; initialStatus?: string }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [filters, setFilters] = useState<AdminDirectoryFilters>({ perPage: 25, status: initialStatus || undefined });
  const config = view === "shops" && initialStatus === "pending_approval"
    ? { label: "Bekleyen Dükkan Onayları", empty: "Onay bekleyen dükkan başvurusu yok." }
    : VIEW_CONFIG[view];
  const entityPath = ADMIN_ENTITY_PATH[view];
  const userPath = "/admin/recent-users";
  const shopPath = initialStatus === "pending_approval" ? "/admin/pending-approvals" : entityPath;

  const users = useApiQuery<MaskedUser[] | Paginated<MaskedUser>>([userPath, "admin", filters], {
    enabled: view === "customers",
    query: { search: filters.search, status: filters.status, per_page: filters.perPage },
  });
  const shops = useApiQuery<Shop[] | Paginated<Shop>>([shopPath, "admin", filters], {
    enabled: view === "shops",
    query: initialStatus === "pending_approval"
      ? { search: filters.search, per_page: filters.perPage }
      : { search: filters.search, status: filters.status, city: filters.city, per_page: filters.perPage },
  });
  const sponsors = useApiQuery<Sponsor[] | Paginated<Sponsor>>([entityPath, "admin", filters], {
    enabled: view === "sponsors",
    query: { search: filters.search, status: filters.status, per_page: filters.perPage },
  });

  const setUserStatus = useApiMutation<{ id: string; status: "active" | "suspended" }, MaskedUser>((input) =>
    adminApi.setUserStatus(input.id, input.status),
  );
  const setShopStatus = useApiMutation<{ id: string; status: "active" | "suspended" }, Shop>((input) =>
    adminApi.setShopStatus(input.id, input.status),
  );

  const query = view === "customers" ? users : view === "shops" ? shops : sponsors;
  const userRecords = listFromResponse(users.data);
  const shopRecords = listFromResponse(shops.data);
  const sponsorRecords = listFromResponse(sponsors.data);
  const recordCount = view === "customers" ? userRecords.length
    : view === "shops" ? shopRecords.length
      : sponsorRecords.length;
  const isLoading = query.isLoading;
  const error = query.error;

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilters((current) => ({ ...current, search, status: status || undefined, page: 1 }));
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-zinc-200">{config.label}</h2>
          <p className="mt-1 text-[11px] text-zinc-500">
            {isLoading ? "Yükleniyor…" : `${recordCount} kayıt listelendi`}
          </p>
        </div>
        {view === "customers" && (
          <span className="inline-flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-[10px] text-zinc-400">
            <Lock size={11} /> KVKK: ad, telefon ve e-posta maskeli
          </span>
        )}
      </div>

      <form onSubmit={submit}>
        <FormFieldset className="flex flex-wrap items-end gap-2">
        <FormField label="Kayıtlarda ara" description="İsim veya işletme adıyla arayın.">
          <FormInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Kayıtlarda ara..." className="sm:w-72" />
        </FormField>
        {initialStatus !== "pending_approval" && (
          <FormListbox
            label="Durum"
            description="Kayıtları hesaba ait duruma göre filtreleyin."
            value={status}
            onChange={setStatus}
            placeholder="Tüm durumlar"
            options={[
              { value: "active", label: "Aktif" },
              { value: "pending_approval", label: "Onay bekliyor" },
              { value: "suspended", label: "Askıda" },
            ]}
            className="sm:w-56"
          />
        )}
        <button type="submit" className="h-9 rounded-md bg-zinc-100 px-4 text-xs font-medium text-zinc-950 hover:bg-white">
          Uygula
        </button>
        </FormFieldset>
      </form>

      <ErrorAlert message={error} onRetry={query.refresh} />
      {(setUserStatus.error || setShopStatus.error) && <ErrorAlert message={setUserStatus.error || setShopStatus.error} />}

      {isLoading ? (
        <SkeletonRows rows={5} columns={4} />
      ) : recordCount === 0 ? (
        <EmptyState message={config.empty} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-800">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="bg-zinc-900/60 text-zinc-500">
              <tr>
                <th className="px-3 py-3 font-medium">Kayıt</th>
                <th className="px-3 py-3 font-medium">İletişim</th>
                <th className="px-3 py-3 font-medium">Durum</th>
                <th className="px-3 py-3 text-right font-medium">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70 bg-zinc-950">
              {view === "customers" &&
                userRecords.map((user) => (
                  <tr key={user.id}>
                    <td className="px-3 py-3 text-zinc-200">
                      {user.firstName} {user.maskedSurname}
                      <p className="mt-0.5 text-[10px] text-zinc-600">{user.role}</p>
                    </td>
                    <td className="px-3 py-3 text-zinc-400">
                      {user.maskedPhone}
                      <p className="mt-0.5 text-[10px] text-zinc-600">{user.maskedEmail}</p>
                    </td>
                    <td className="px-3 py-3 text-zinc-400">{user.status}</td>
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        disabled={setUserStatus.isPending}
                        onClick={async () => {
                          if (await setUserStatus.run({ id: user.id, status: user.status === "active" ? "suspended" : "active" })) {
                            users.refresh();
                          }
                        }}
                        className="rounded border border-zinc-800 px-2.5 py-1.5 text-[11px] text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
                      >
                        {user.status === "active" ? "Askıya al" : "Aktifleştir"}
                      </button>
                    </td>
                  </tr>
                ))}

              {view === "shops" &&
                shopRecords.map((shop) => (
                  <tr key={shop.id}>
                    <td className="px-3 py-3 text-zinc-200">
                      {shop.name}
                      <p className="mt-0.5 text-[10px] text-zinc-600">{shop.address.district.name} / {shop.address.district.city.name}</p>
                    </td>
                    <td className="px-3 py-3 text-zinc-400">{shop.phone}</td>
                    <td className="px-3 py-3 text-zinc-400">{shop.status}</td>
                    <td className="px-3 py-3 text-right text-[11px] text-zinc-500">
                      {shop.status === "pending_approval" || shop.status === "suspended" ? (
                        <button
                          type="button"
                          disabled={setShopStatus.isPending}
                          onClick={async () => {
                            if (await setShopStatus.run({ id: shop.id, status: "active" })) shops.refresh();
                          }}
                          className="rounded border border-emerald-900 px-2.5 py-1.5 text-emerald-300 hover:bg-emerald-950/40 disabled:opacity-50"
                        >
                          Onayla / aktifleştir
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={setShopStatus.isPending}
                          onClick={async () => {
                            if (await setShopStatus.run({ id: shop.id, status: "suspended" })) shops.refresh();
                          }}
                          className="rounded border border-rose-900 px-2.5 py-1.5 text-rose-300 hover:bg-rose-950/40 disabled:opacity-50"
                        >
                          Askıya al
                        </button>
                      )}
                    </td>
                  </tr>
                ))}

              {view === "sponsors" &&
                sponsorRecords.map((sponsor) => (
                  <tr key={sponsor.id}>
                    <td className="px-3 py-3 text-zinc-200">
                      {sponsor.companyName}
                      <p className="mt-0.5 text-[10px] text-zinc-600">{sponsor.contactName}</p>
                    </td>
                    <td className="px-3 py-3 text-zinc-400">{sponsor.email}</td>
                    <td className="px-3 py-3 text-zinc-400">{sponsor.status}</td>
                    <td className="px-3 py-3 text-right text-[11px] text-zinc-300">
                      {sponsor.dailyBudget.toLocaleString("tr-TR")} ₺ / gün
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
