"use client";

import { useMemo, useState } from "react";
import type { ShopSearchFilters } from "@/lib/services";
import { useApiQuery } from "@/lib/use-api";
import { ErrorAlert, SkeletonCards } from "@/components/feedback/Skeleton";
import { Combobox } from "@/components/ui/Combobox";
import type { Shop } from "@/types/api";
import { useAuth } from "@/components/providers/auth-provider";
import { ShopGrid } from "@/components/user/ShopGrid";
import { FormField, FormFieldset, FormInput, FormListbox } from "@/components/ui/form";

type ShopSort = NonNullable<ShopSearchFilters["sort"]>;
const SORT_OPTIONS: { value: ShopSort; label: string }[] = [
  { value: "rating_desc", label: "Puan (yüksek → düşük)" },
  { value: "reviews_desc", label: "En çok değerlendirilen" },
  { value: "name_asc", label: "İsme göre (A-Z)" },
  { value: "rating_asc", label: "Puan (düşük → yüksek)" },
];

function ShopSearchContent({
  initialCity,
  initialDistrict,
  authError,
}: {
  initialCity: string;
  initialDistrict: string;
  authError: string;
}) {
  const [draft, setDraft] = useState({ search: "", city: initialCity, district: initialDistrict, service: "", minRating: "" });
  const [filters, setFilters] = useState<ShopSearchFilters>({
    sort: "rating_desc",
    perPage: 24,
    city: initialCity || undefined,
    district: initialDistrict || undefined,
  });
  const [sort, setSort] = useState<ShopSearchFilters["sort"]>("rating_desc");
  const query = useMemo(
    () => ["/shops", { ...filters, sort }] as const,
    [filters, sort],
  );
  const { data, error, isLoading, refresh } = useApiQuery<Shop[]>(query, {
    list: true,
    query: {
      search: filters.search,
      city: filters.city,
      district: filters.district,
      service: filters.service,
      min_rating: filters.minRating ? Number(filters.minRating) : undefined,
      sort,
      per_page: filters.perPage,
    },
  });

  const { data: cities = [], error: citiesError } = useApiQuery<string[]>(["/locations/cities"], { list: true });
  const { data: districts = [], error: districtsError } = useApiQuery<string[]>(
    ["/locations/districts", draft.city],
    { list: true, enabled: Boolean(draft.city), query: { city: draft.city } },
  );
  const { data: services = [] } = useApiQuery<string[]>(["/shops/meta/services"], { list: true });

  const changeCity = (city: string) => {
    setDraft((current) => ({ ...current, city, district: "" }));
    setFilters((current) => ({ ...current, city: city || undefined, district: undefined, page: 1 }));
  };

  const changeDistrict = (district: string) => {
    setDraft((current) => ({ ...current, district }));
    setFilters((current) => ({ ...current, district: district || undefined, page: 1 }));
  };

  const applyFilters = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilters((current) => ({
      ...current,
      search: draft.search,
      city: draft.city || undefined,
      district: draft.district || undefined,
      service: draft.service,
      minRating: draft.minRating ? Number(draft.minRating) : undefined,
      page: 1,
    }));
  };

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Dükkan Ara</h1>
        <p className="mt-1 text-xs text-zinc-500">Onaylanmış dükkanlar; puan, konum ve hizmete göre filtrelenebilir.</p>
      </div>

      <form onSubmit={applyFilters}>
        <FormFieldset className="grid gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-4 sm:grid-cols-2 lg:grid-cols-6">
        <FormField label="Berber / dükkan adı" description="İşletme adına göre arama yapın.">
          <FormInput
            value={draft.search}
            onChange={(event) => setDraft({ ...draft, search: event.target.value })}
            placeholder="Makas &amp; Sanat"
          />
        </FormField>
        <Combobox label="İl" description="Şehre göre sonuçları filtreleyin." options={cities} value={draft.city} onChange={changeCity} placeholder="Tüm İller" searchPlaceholder="İl ara..." />
        <Combobox label="İlçe" description="Seçilen ildeki ilçeyi belirleyin." options={districts} value={draft.district} onChange={changeDistrict} placeholder={draft.city ? "Tüm İlçeler" : "Önce il seçin"} searchPlaceholder="İlçe ara..." disabled={!draft.city} />
        <Combobox label="Hizmet" description="Sunulan hizmete göre sonuçları daraltın." options={services} value={draft.service} onChange={(val) => setDraft({ ...draft, service: val })} placeholder="Tüm Hizmetler" searchPlaceholder="Hizmet ara..." />
        <FormListbox
          label="Min. puan"
          description="Gösterilecek salonlar için en düşük puanı seçin."
          value={draft.minRating}
          onChange={(minRating) => setDraft((current) => ({ ...current, minRating }))}
          placeholder="Tümü"
          options={[{ value: "4", label: "4+" }, { value: "4.5", label: "4.5+" }, { value: "5", label: "5" }]}
        />
        <div className="flex items-end">
          <button type="submit" className="h-9 w-full rounded bg-zinc-100 text-xs font-medium text-zinc-950 hover:bg-white">
            Filtrele
          </button>
        </div>
        </FormFieldset>
      </form>

      {(authError || citiesError || districtsError) && (
        <p role="alert" className="text-xs text-rose-300">{authError || citiesError || districtsError}</p>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">
          {isLoading ? "Yükleniyor…" : `${data?.length ?? 0} dükkan listelendi`}
        </p>
        <FormListbox<ShopSort> label="Sıralama" description="Sonuçların sıralama ölçütünü seçin." value={sort ?? "rating_desc"} onChange={(value) => setSort(value || "rating_desc")} options={SORT_OPTIONS} className="flex items-center gap-2 text-xs text-zinc-500" />
      </div>

      <ErrorAlert message={error} onRetry={refresh} />
      <ShopGrid shops={data ?? []} isLoading={isLoading} />
    </section>
  );
}

export function ShopSearch() {
  const { user, status, error } = useAuth();
  if (status === "loading") return <SkeletonCards />;

  const city = status === "authenticated" && user?.role === "customer" ? user.city ?? "" : "";
  const district = city && status === "authenticated" && user?.role === "customer" ? user.district ?? "" : "";
  const key = `${user?.id ?? "guest"}:${city}:${district}`;

  return (
    <ShopSearchContent
      key={key}
      initialCity={city}
      initialDistrict={district}
      authError={error}
    />
  );
}
