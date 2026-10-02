"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { adminApi } from "@/lib/services";
import { useApiMutation, useApiQuery } from "@/lib/use-api";
import { ErrorAlert, EmptyState, SkeletonRows } from "@/components/feedback/Skeleton";
import type { AdminApproval } from "@/types/api";
import { FormField, FormFieldset, FormListbox, FormTextarea } from "@/components/ui/form";

const KIND_LABEL: Record<AdminApproval["kind"], string> = {
  shop_profile_image: "Dükkan profil fotoğrafı",
  shop_cover_image: "Dükkan kapak fotoğrafı",
  shop_information: "Dükkan bilgisi",
  staff_profile: "Personel profili",
  staff_photo: "Personel fotoğrafı",
};

/**
 * Fotoğraf & Personel Onay Kuyruğu — GET /admin/approvals
 * PATCH /admin/approvals/{id}/approve | /reject
 */
export function AdminApprovalQueue() {
  const [filter, setFilter] = useState<AdminApproval["status"]>("pending_approval");
  const [rejecting, setRejecting] = useState<{ item: AdminApproval; reason: string } | null>(null);

  const queue = useApiQuery<AdminApproval[]>(["/admin/approvals", filter], { list: true, query: { status: filter } });
  const approve = useApiMutation<string, AdminApproval>(adminApi.approve);
  const reject = useApiMutation<{ id: string; reason: string }, AdminApproval>((input) =>
    adminApi.reject(input.id, input.reason),
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-zinc-200">Fotoğraf &amp; Personel Onay Kuyruğu</h2>
          <p className="mt-1 text-[11px] text-zinc-500">Onaylanmayan içerikler müşteri tarafında yayınlanmaz.</p>
        </div>
        <FormListbox
          label="Onay durumu"
          description="Onay kayıtlarını durumlarına göre filtreleyin."
          value={filter}
          onChange={(value) => setFilter(value || "pending_approval")}
          options={[
            { value: "pending_approval", label: "Onay bekleyenler" },
            { value: "approved", label: "Onaylananlar" },
            { value: "rejected", label: "Reddedilenler" },
          ]}
        />
      </div>

      <ErrorAlert message={queue.error || approve.error || reject.error} onRetry={queue.refresh} />

      {queue.isLoading ? (
        <SkeletonRows rows={3} columns={2} />
      ) : (queue.data ?? []).length === 0 ? (
        <EmptyState message="Bu durumda bekleyen onay talebi yok." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {(queue.data ?? []).map((item) => (
            <article key={item.id} className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
              {item.previewUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img crossOrigin="use-credentials" src={item.previewUrl} alt={item.title} className="aspect-2/1 w-full object-cover" />
              )}
              <div className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    {item.status === "pending_approval" ? (
                      <span className="rounded border border-amber-800 bg-amber-950/50 px-2 py-1 text-[10px] text-amber-200">⏳ Onay bekliyor</span>
                    ) : (
                      <span className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-[10px] text-zinc-300">
                        {item.status === "approved" ? "Onaylandı" : "Reddedildi"}
                      </span>
                    )}
                    <h3 className="mt-2.5 text-sm font-medium text-zinc-100">{item.title}</h3>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      {KIND_LABEL[item.kind]}{item.shopName ? ` · ${item.shopName}` : ""}
                    </p>
                  </div>
                  <time className="text-[10px] text-zinc-600">{new Date(item.submittedAt).toLocaleString("tr-TR")}</time>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-zinc-400">{item.description}</p>
                {item.rejectionReason && (
                  <p className="mt-2 rounded bg-rose-950/40 p-2.5 text-[11px] text-rose-300">Ret gerekçesi: {item.rejectionReason}</p>
                )}
                {item.status === "pending_approval" && (
                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setRejecting({ item, reason: "" })}
                      className="inline-flex items-center gap-1.5 rounded border border-rose-900 px-3 py-2 text-xs text-rose-300 hover:bg-rose-950/40"
                    >
                      <X size={13} />Reddet
                    </button>
                    <button
                      type="button"
                      disabled={approve.isPending}
                      onClick={async () => { if (await approve.run(item.id)) queue.refresh(); }}
                      className="inline-flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      <Check size={13} />{approve.isPending ? "Kaydediliyor..." : "Onayla & yayınla"}
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {rejecting && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-3"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setRejecting(null); }}
        >
          <section role="dialog" aria-modal="true" aria-label="Onay talebini reddet" className="w-full max-w-sm space-y-3 rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
            <h3 className="text-sm font-semibold text-zinc-100">Talebi reddet</h3>
            <p className="text-[11px] text-zinc-500">{rejecting.item.title}</p>
            <FormFieldset className="space-y-3">
            <FormField label="Ret gerekçesi" description="Talebin neden reddedildiğini en az 5 karakterle açıklayın.">
              <FormTextarea
                required
                value={rejecting.reason}
                onChange={(event) => setRejecting({ ...rejecting, reason: event.target.value })}
                placeholder="Örn. Fotoğraf bulanık, lütfen tekrar yükleyin."
              />
            </FormField>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setRejecting(null)} className="rounded-md border border-zinc-800 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-900">
                Vazgeç
              </button>
              <button
                type="button"
                disabled={rejecting.reason.trim().length < 5 || reject.isPending}
                onClick={async () => {
                  if (await reject.run({ id: rejecting.item.id, reason: rejecting.reason.trim() })) {
                    setRejecting(null);
                    queue.refresh();
                  }
                }}
                className="rounded-md bg-rose-600 px-3 py-2 text-xs font-medium text-white hover:bg-rose-500 disabled:opacity-50"
              >
                {reject.isPending ? "Gönderiliyor..." : "Reddet"}
              </button>
            </div>
            </FormFieldset>
          </section>
        </div>
      )}
    </section>
  );
}
