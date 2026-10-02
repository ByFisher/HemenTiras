"use client";

import { useState } from "react";
import { ErrorAlert, SkeletonRows } from "@/components/feedback/Skeleton";
import { FormField, FormInput, FormListbox } from "@/components/ui/form";
import { useApiQuery } from "@/lib/use-api";
import type { Paginated } from "@/types/api";

interface FinancialLog {
  id: string;
  shopId: string | null;
  shopName: string | null;
  userId: string | null;
  userName: string | null;
  type: "payment" | "refund" | "commission" | "coupon_discount";
  amount: number;
  description: string;
  createdAt: string;
}

interface FinancialLogPage extends Paginated<FinancialLog> {
  availableBalance?: number;
}

const TYPE_OPTIONS = [
  { value: "payment", label: "Tahsilat" },
  { value: "refund", label: "İade" },
  { value: "commission", label: "Komisyon" },
  { value: "coupon_discount", label: "Kupon indirimi" },
] as const;

const formatMoney = (value: number) => `${value.toLocaleString("tr-TR")} ₺`;

export function FinancialLogsPanel({ shop = false }: { shop?: boolean }) {
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const path = shop ? "/shop/financial-logs" : "/admin/financial-logs";
  const query = useApiQuery<FinancialLogPage>(
    [path, type, from, to, page],
    { query: shop ? { page, per_page: 100 } : { type, from, to, page, per_page: 100 } },
  );
  const rows = query.data?.data ?? [];

  return (
    <section className="space-y-4">
      {shop && query.data?.availableBalance !== undefined && (
        <div className="rounded-lg border border-lime-900/70 bg-lime-950/30 p-4">
          <p className="text-[11px] text-lime-300">Kupon rezervleri düşüldükten sonra kullanılabilir bakiye</p>
          <p className="mt-1 text-xl font-semibold text-zinc-100">{formatMoney(query.data.availableBalance)}</p>
        </div>
      )}
      {!shop && (
        <div className="grid gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-4 sm:grid-cols-3">
          <FormListbox
            label="Hareket türü"
            description="Tüm hareketler veya tek bir kayıt türü."
            value={type}
            onChange={(value) => { setType(value); setPage(1); }}
            options={TYPE_OPTIONS}
            placeholder="Tüm türler"
          />
          <FormField label="Başlangıç tarihi" description="Dahil edilir.">
            <FormInput type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} />
          </FormField>
          <FormField label="Bitiş tarihi" description="Dahil edilir.">
            <FormInput type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} />
          </FormField>
        </div>
      )}
      <ErrorAlert message={query.error} onRetry={query.refresh} />
      {query.isLoading ? <SkeletonRows rows={5} columns={5} /> : rows.length === 0 ? (
        <p className="rounded-lg border border-zinc-800 bg-zinc-950 p-8 text-center text-xs text-zinc-500">
          Finansal hareket bulunamadı.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="bg-zinc-900/70 text-zinc-500">
              <tr>
                <th className="px-3 py-3 font-medium">Tarih</th>
                {!shop && <th className="px-3 py-3 font-medium">Dükkan</th>}
                <th className="px-3 py-3 font-medium">İşlem</th>
                <th className="px-3 py-3 font-medium">Kullanıcı</th>
                <th className="px-3 py-3 font-medium">Açıklama</th>
                <th className="px-3 py-3 text-right font-medium">Tutar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70 bg-zinc-950">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap px-3 py-3 text-zinc-400">
                    {new Date(row.createdAt).toLocaleString("tr-TR")}
                  </td>
                  {!shop && <td className="px-3 py-3 text-zinc-300">{row.shopName ?? "—"}</td>}
                  <td className="px-3 py-3 text-zinc-300">{TYPE_OPTIONS.find((option) => option.value === row.type)?.label ?? row.type}</td>
                  <td className="px-3 py-3 text-zinc-400">{row.userName ?? "—"}</td>
                  <td className="max-w-sm px-3 py-3 text-zinc-400">{row.description}</td>
                  <td className={`whitespace-nowrap px-3 py-3 text-right font-medium ${row.amount < 0 ? "text-rose-300" : "text-emerald-300"}`}>
                    {formatMoney(row.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {query.data && query.data.meta.lastPage > 1 && (
        <nav aria-label="Finans kayıtları sayfaları" className="flex items-center justify-between text-xs text-zinc-400">
          <span>{query.data.meta.total.toLocaleString("tr-TR")} kayıttan {page}. sayfa</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded border border-zinc-800 px-3 py-2 disabled:opacity-40">Önceki</button>
            <button type="button" disabled={page >= query.data.meta.lastPage} onClick={() => setPage((current) => current + 1)} className="rounded border border-zinc-800 px-3 py-2 disabled:opacity-40">Sonraki</button>
          </div>
        </nav>
      )}
    </section>
  );
}
