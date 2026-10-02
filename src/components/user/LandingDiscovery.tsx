"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { Combobox } from "@/components/ui/Combobox";
import { ErrorAlert, SkeletonCards } from "@/components/feedback/Skeleton";
import { ShopGrid } from "@/components/user/ShopGrid";
import type { ShopSearchFilters } from "@/lib/services";
import { useApiQuery } from "@/lib/use-api";
import { FormCheckboxField, FormField, FormFieldset, FormInput, FormListbox } from "@/components/ui/form";

function LandingDiscoveryContent({
  initialCity,
  initialDistrict,
}: {
  initialCity: string;
  initialDistrict: string;
}) {
  const [draft, setDraft] = useState({
    search: "",
    city: initialCity,
    district: initialDistrict,
    service: "",
    minRating: "",
  });
  const [filters, setFilters] = useState<ShopSearchFilters>({
    city: initialCity || undefined,
    district: initialDistrict || undefined,
    perPage: 24,
    sort: "rating_desc",
  });

  const query = useMemo(() => ["/shops", filters] as const, [filters]);
  const shops = useApiQuery<import("@/types/api").Shop[]>(query, {
    list: true,
    query: {
      search: filters.search,
      city: filters.city,
      district: filters.district,
      service: filters.service,
      min_rating: filters.minRating,
      sort: filters.sort,
      per_page: filters.perPage,
    },
  });
  const { data: cities = [], error: citiesError } = useApiQuery<string[]>(["/locations/cities"], { list: true });
  const { data: districts = [], error: districtsError } = useApiQuery<string[]>(
    ["/locations/districts", draft.city],
    { enabled: Boolean(draft.city), list: true, query: { city: draft.city } },
  );
  const { data: services = [], error: servicesError } = useApiQuery<string[]>(["/shops/meta/services"], { list: true });

  const changeCity = (city: string) => {
    setDraft((current) => ({ ...current, city, district: "" }));
    setFilters((current) => ({ ...current, city: city || undefined, district: undefined, page: 1 }));
  };

  const changeDistrict = (district: string) => {
    setDraft((current) => ({ ...current, district }));
    setFilters((current) => ({ ...current, district: district || undefined, page: 1 }));
  };

  const applySearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilters((current) => ({
      ...current,
      search: draft.search.trim() || undefined,
      city: draft.city || undefined,
      district: draft.district || undefined,
      service: draft.service || undefined,
      minRating: draft.minRating ? Number(draft.minRating) : undefined,
      page: 1,
    }));
  };

  const toggleService = (service: string) => {
    const nextService = draft.service === service ? "" : service;
    setDraft((current) => ({ ...current, service: nextService }));
    setFilters((current) => ({ ...current, service: nextService || undefined, page: 1 }));
  };

  const setMinimumRating = (rating: string) => {
    setDraft((current) => ({ ...current, minRating: rating }));
    setFilters((current) => ({
      ...current,
      minRating: rating ? Number(rating) : undefined,
      page: 1,
    }));
  };

  return (
    <section id="salonlari-kesfet" className="mx-auto w-full max-w-7xl scroll-mt-6 px-5 pb-20 sm:px-8 lg:px-12">
      <div className="mb-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-300">Sana yakın bakım</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Salonları keşfet</h2>
        <p className="mt-2 text-sm text-zinc-500">Konumuna uygun berber ve kuaförleri, hizmetlerini ve fiyatlarını karşılaştır.</p>
      </div>

      <form onSubmit={applySearch}>
        <FormFieldset className="grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/90 p-3 shadow-2xl shadow-black/20 md:grid-cols-2 xl:grid-cols-[minmax(220px,1.3fr)_minmax(150px,0.8fr)_minmax(150px,0.8fr)_minmax(170px,0.9fr)_auto]">
        <FormField label="Dükkan veya berber" description="İşletme adıyla salon arayın." className="justify-center">
            <FormInput
              value={draft.search}
              onChange={(event) => setDraft((current) => ({ ...current, search: event.target.value }))}
              placeholder="İşletme adı ara"
            />
        </FormField>
        <Combobox label="İl" description="İl seçerek sonuçları daraltın." options={cities} value={draft.city} onChange={changeCity} placeholder="Tüm iller" searchPlaceholder="İl ara..." />
        <Combobox label="İlçe" description="Seçilen il içindeki ilçelerden birini seçin." options={districts} value={draft.district} onChange={changeDistrict} placeholder={draft.city ? "Tüm ilçeler" : "Önce il seçin"} searchPlaceholder="İlçe ara..." disabled={!draft.city} />
        <Combobox label="Hizmet" description="Sunulan hizmete göre salon arayın." options={services} value={draft.service} onChange={(service) => setDraft((current) => ({ ...current, service }))} placeholder="Tüm hizmetler" searchPlaceholder="Hizmet ara..." />
        <button type="submit" className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-white px-5 text-xs font-semibold text-zinc-950 transition hover:bg-zinc-200">
          <Search size={14} /> Salon bul
        </button>
        </FormFieldset>
      </form>

      {(shops.error || citiesError || districtsError || servicesError) && (
        <div className="mt-4"><ErrorAlert message={shops.error || citiesError || districtsError || servicesError} onRetry={shops.refresh} /></div>
      )}

      <div className="mt-8 grid items-start gap-7 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="space-y-6 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
            <SlidersHorizontal size={14} className="text-zinc-200" /> Hızlı filtreler
          </div>
          <FormFieldset>
            <FormListbox
              label="En düşük puan"
              description="Sonuçları en düşük puan eşiğine göre filtreleyin."
              value={draft.minRating}
              onChange={setMinimumRating}
              placeholder="Tüm puanlar"
              options={[
                { value: "4", label: "4+ yıldız" },
                { value: "4.5", label: "4.5+ yıldız" },
              ]}
            />
          </FormFieldset>
          <FormFieldset className="space-y-2">
            <p className="text-[11px] font-medium text-zinc-400">Hizmet türleri</p>
            {services.slice(0, 10).map((service) => (
              <FormCheckboxField key={service} label={service} description="Bu hizmeti sunan salonları gösterin." checked={draft.service === service} onChange={() => toggleService(service)} />
            ))}
            {services.length === 0 && !servicesError && <p className="text-[11px] text-zinc-600">Henüz hizmet bulunmuyor.</p>}
          </FormFieldset>
          {(draft.city || draft.district || draft.service || draft.minRating) && (
            <button
              type="button"
              onClick={() => {
                setDraft({ search: "", city: "", district: "", service: "", minRating: "" });
                setFilters({ perPage: 24, sort: "rating_desc" });
              }}
              className="text-[11px] text-zinc-200 hover:text-white"
            >
              Filtreleri temizle
            </button>
          )}
        </aside>

        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-zinc-100">Tüm berber &amp; kuaförler</h3>
              <p className="mt-1 text-[11px] text-zinc-500">
                {shops.isLoading ? "Salonlar yükleniyor..." : `${shops.data?.length ?? 0} salon listeleniyor`}
              </p>
            </div>
            <FormListbox
              label="Sırala"
              description="Salon listesinin sıralama ölçütünü seçin."
              value={filters.sort ?? "rating_desc"}
              onChange={(sort) => setFilters((current) => ({ ...current, sort: sort || undefined, page: 1 }))}
              options={[
                { value: "rating_desc", label: "Puanı yüksek" },
                { value: "reviews_desc", label: "En çok yorum" },
                { value: "name_asc", label: "İsme göre" },
                { value: "rating_asc", label: "Puanı düşük" },
              ]}
              className="flex items-center gap-2 text-[11px] text-zinc-500"
            />
          </div>
          <ShopGrid shops={shops.data ?? []} isLoading={shops.isLoading} />
        </div>
      </div>
    </section>
  );
}

export function LandingDiscovery() {
  const { user, status, error, refresh } = useAuth();
  if (status === "loading") return <div className="mx-auto max-w-7xl px-5 pb-20 sm:px-8 lg:px-12"><SkeletonCards /></div>;

  const city = status === "authenticated" && user?.role === "customer" ? user.city ?? "" : "";
  const district = city && status === "authenticated" && user?.role === "customer" ? user.district ?? "" : "";

  return (
    <>
      {status === "error" && (
        <div className="mx-auto max-w-7xl px-5 pb-4 sm:px-8 lg:px-12">
          <ErrorAlert message={error} onRetry={() => void refresh()} />
        </div>
      )}
      <LandingDiscoveryContent key={`${user?.id ?? "guest"}:${city}:${district}`} initialCity={city} initialDistrict={district} />
    </>
  );
}
