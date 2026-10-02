"use client";

import { useState, type FormEvent } from "react";
import { Download, Filter } from "lucide-react";
import { adminApi, type AccessLogFilters } from "@/lib/services";
import { useApiQuery } from "@/lib/use-api";
import { ErrorAlert, EmptyState, SkeletonRows } from "@/components/feedback/Skeleton";
import { FormField, FormFieldset, FormInput, FormListbox } from "@/components/ui/form";
import type { AccessLog, Paginated } from "@/types/api";

type LogFilterState = Omit<AccessLogFilters, "page" | "perPage"> & { userId?: string; method?: string };

const deviceOptions: { value: AccessLog["deviceType"]; label: string }[] = [
  { value: "desktop", label: "Masaüstü" },
  { value: "mobile", label: "Mobil" },
  { value: "tablet", label: "Tablet" },
  { value: "bot", label: "Bot" },
  { value: "unknown", label: "Bilinmiyor" },
];
const methodOptions = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"].map((value) => ({ value, label: value }));

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "medium", timeZone: "Europe/Istanbul" }).format(new Date(value));
}

export function AccessLogsPanel() {
  const [draft, setDraft] = useState<LogFilterState>({});
  const [filters, setFilters] = useState<LogFilterState>({});
  const [page, setPage] = useState(1);
  const [exportError, setExportError] = useState("");
  const [exporting, setExporting] = useState(false);
  const result = useApiQuery<Paginated<AccessLog>>(
    ["/admin/access-logs", filters, page],
    {
      query: {
        ip: filters.ip,
        from: filters.from,
        to: filters.to,
        user_id: filters.userId,
        device_type: filters.deviceType,
        method: filters.method,
        per_page: 50,
        page,
      },
    },
  );
  const rows = result.data?.data ?? [];
  const meta = result.data?.meta;

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilters({ ...draft, ip: draft.ip?.trim() || undefined, userId: draft.userId?.trim() || undefined });
    setPage(1);
  };

  const exportCsv = async () => {
    setExporting(true);
    setExportError("");
    try {
      const { blob, filename } = await adminApi.exportAccessLogs(filters);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (reason) {
      setExportError(reason instanceof Error ? reason.message : "CSV dışa aktarılamadı.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-amber-900/60 bg-amber-950/20 p-3 text-xs leading-relaxed text-amber-200/80">
        Bu kayıtlar kişisel veri içerebilir. Yalnızca yetkili personel erişmeli; saklama süresi, hukuki sebep ve bilgilendirme metni yürürlükteki politikanıza göre belirlenmelidir. İstemci kaynak portu uygulama katmanından güvenilir şekilde alınamadığından boş tutulur.
      </div>
      <form onSubmit={applyFilters} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
        <FormFieldset className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FormField label="IP adresi" description="IPv4 veya IPv6.">
            <FormInput value={draft.ip ?? ""} onChange={(event) => setDraft((current) => ({ ...current, ip: event.target.value }))} placeholder="192.0.2.1" />
          </FormField>
          <FormField label="Başlangıç tarihi" description="UTC kayıt zamanına göre.">
            <FormInput type="date" value={draft.from ?? ""} onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value || undefined }))} />
          </FormField>
          <FormField label="Bitiş tarihi" description="UTC kayıt zamanına göre.">
            <FormInput type="date" value={draft.to ?? ""} onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value || undefined }))} />
          </FormField>
          <FormField label="Kullanıcı ID" description="Kimliği doğrulanmış kullanıcı.">
            <FormInput inputMode="numeric" value={draft.userId ?? ""} onChange={(event) => setDraft((current) => ({ ...current, userId: event.target.value || undefined }))} />
          </FormField>
          <FormListbox
            label="Cihaz türü"
            description="User-Agent üzerinden sınıflandırılır."
            value={draft.deviceType ?? ""}
            onChange={(deviceType) => setDraft((current) => ({ ...current, deviceType: deviceType || undefined }))}
            options={deviceOptions}
            placeholder="Tüm cihazlar"
          />
          <FormListbox
            label="HTTP işlemi"
            description="İstek yöntemine göre filtrele."
            value={draft.method ?? ""}
            onChange={(method) => setDraft((current) => ({ ...current, method: method || undefined }))}
            options={methodOptions}
            placeholder="Tüm işlemler"
          />
          <button type="submit" className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-zinc-100 px-4 text-xs font-semibold text-zinc-950 hover:bg-white">
            <Filter size={14} /> Filtrele
          </button>
          <button type="button" disabled={exporting} onClick={() => void exportCsv()} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-zinc-700 px-4 text-xs text-zinc-200 hover:bg-zinc-900 disabled:opacity-50">
            <Download size={14} /> {exporting ? "Hazırlanıyor…" : "CSV dışa aktar"}
          </button>
        </FormFieldset>
      </form>

      <ErrorAlert message={result.error || exportError} onRetry={result.refresh} />
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>{meta ? `${meta.total} kayıt` : "Erişim kayıtları"}</span>
        {meta && <span>Sayfa {meta.currentPage} / {meta.lastPage}</span>}
      </div>
      {result.isLoading ? <SkeletonRows rows={6} columns={6} /> : rows.length === 0 ? <EmptyState message="Seçilen filtrelerle erişim kaydı bulunamadı." /> : (
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="bg-zinc-900/70 text-zinc-500">
              <tr>
                <th className="px-3 py-3 font-medium">Tarih (TR)</th>
                <th className="px-3 py-3 font-medium">IP / Kullanıcı</th>
                <th className="px-3 py-3 font-medium">Cihaz</th>
                <th className="px-3 py-3 font-medium">İşlem</th>
                <th className="px-3 py-3 font-medium">Durum</th>
                <th className="px-3 py-3 font-medium">Rıza kaydı</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70 bg-zinc-950">
              {rows.map((log) => (
                <tr key={log.id}>
                  <td className="whitespace-nowrap px-3 py-3 text-zinc-300">
                    {formatDate(log.occurredAtLocal)}
                    <p className="mt-1 text-[10px] text-zinc-600">UTC {formatDate(log.occurredAtUtc)}</p>
                  </td>
                  <td className="px-3 py-3 text-zinc-300">
                    {log.ipAddress ?? "—"}
                    <p className="mt-1 text-[10px] text-zinc-600">{log.userId ? `Kullanıcı #${log.userId}` : `Anonim ${log.anonymousVisitorId?.slice(0, 8) ?? "—"}`}</p>
                  </td>
                  <td className="px-3 py-3 text-zinc-400">{log.deviceType}<p className="mt-1 max-w-52 truncate text-[10px] text-zinc-600" title={log.userAgent ?? undefined}>{log.userAgent ?? "User-Agent yok"}</p></td>
                  <td className="px-3 py-3 text-zinc-300"><span className="font-mono">{log.method}</span><p className="mt-1 max-w-64 truncate text-[10px] text-zinc-500" title={log.path}>{log.path}</p></td>
                  <td className="px-3 py-3 text-zinc-400">{log.status}</td>
                  <td className="px-3 py-3 text-zinc-400">
                    {log.privacyNoticeVersion ? `Aydınlatma ${log.privacyNoticeVersion}` : "Aydınlatma kaydı yok"}
                    <p className="mt-1 text-[10px] text-zinc-600">
                      {log.explicitConsentAt === null ? "Açık rıza kaydı yok" : `${log.explicitConsentPurpose}: ${log.explicitConsentGranted ? "verildi" : "verilmedi"} (${log.explicitConsentVersion})`}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {meta && meta.lastPage > 1 && (
        <div className="flex justify-end gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded border border-zinc-800 px-3 py-2 text-xs text-zinc-300 disabled:opacity-40">Önceki</button>
          <button type="button" disabled={page >= meta.lastPage} onClick={() => setPage((value) => value + 1)} className="rounded border border-zinc-800 px-3 py-2 text-xs text-zinc-300 disabled:opacity-40">Sonraki</button>
        </div>
      )}
    </section>
  );
}
