"use client";

import { useState } from "react";
import { Check, Trash2, X } from "lucide-react";
import { adminApi } from "@/lib/services";
import { useApiMutation, useApiQuery } from "@/lib/use-api";
import { EmptyState, ErrorAlert, SkeletonRows } from "@/components/feedback/Skeleton";
import { FormListbox } from "@/components/ui/form";
import type { AdminReview, Paginated } from "@/types/api";
import type { SponsorApprovalRequest } from "@/types/portal";

export function AdminReviewQueue() {
  const [status, setStatus] = useState<AdminReview["status"]>("pending_approval");
  const queue = useApiQuery<Paginated<AdminReview>>(["/admin/reviews", status], {
    query: { status, per_page: 50 },
  });
  const approve = useApiMutation<string, AdminReview>(adminApi.approveReview);
  const remove = useApiMutation<string, { message: string }>(adminApi.deleteReview);
  const reviews = queue.data?.data ?? [];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-zinc-200">Yorum Moderasyonu</h2>
          <p className="mt-1 text-[11px] text-zinc-500">Yeni müşteri yorumları onaylanana kadar herkese açık değerlendirmelerde gösterilmez.</p>
        </div>
        <FormListbox
          label="Durum"
          description="İncelenecek yorumları seçin."
          value={status}
          onChange={(next) => setStatus(next || "pending_approval")}
          options={[
            { value: "pending_approval", label: "Onay bekleyenler" },
            { value: "approved", label: "Yayınlananlar" },
          ]}
          clearable={false}
        />
      </div>
      <ErrorAlert message={queue.error || approve.error || remove.error} onRetry={queue.refresh} />
      {queue.isLoading ? <SkeletonRows rows={4} columns={4} /> : reviews.length === 0 ? <EmptyState message="Bu filtrede yorum bulunamadı." /> : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <article key={review.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-zinc-200">{review.shopName ?? "Dükkan"} · {review.staffName}</p>
                  <p className="mt-1 text-[11px] text-zinc-500">{review.customerFirstName} · {new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(review.createdAt))}</p>
                </div>
                <span className="rounded border border-lime-900 bg-lime-950/30 px-2 py-1 text-[11px] text-lime-300">{review.rating} / 5</span>
              </div>
              {review.comment && <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-zinc-300">{review.comment}</p>}
              <div className="mt-4 flex justify-end gap-2">
                {review.status === "pending_approval" && (
                  <button type="button" disabled={approve.isPending} onClick={async () => { if (await approve.run(review.id)) queue.refresh(); }} className="inline-flex items-center gap-1.5 rounded bg-lime-500 px-3 py-2 text-xs font-semibold text-zinc-950 disabled:opacity-50">
                    <Check size={14} /> Yayınla
                  </button>
                )}
                <button
                  type="button"
                  disabled={remove.isPending}
                  onClick={async () => {
                    if (!window.confirm("Bu yorumu kalıcı olarak silmek istiyor musunuz?")) return;
                    if (await remove.run(review.id)) queue.refresh();
                  }}
                  className="inline-flex items-center gap-1.5 rounded border border-rose-900 px-3 py-2 text-xs text-rose-300 disabled:opacity-50"
                >
                  <Trash2 size={14} /> Sil
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function AdminSupportQueue() {
  const queue = useApiQuery<SponsorApprovalRequest[]>(["/admin/support-requests"], { list: true });
  const decide = useApiMutation<{ id: string; decision: "approve" | "reject" }, SponsorApprovalRequest>(
    ({ id, decision }) => adminApi.decideSupportRequest(id, decision),
  );
  const requests = queue.data ?? [];

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-medium text-zinc-200">Destek Talepleri</h2>
        <p className="mt-1 text-[11px] text-zinc-500">Sponsorlar tarafından oluşturulan destek taleplerini inceleyin.</p>
      </div>
      <ErrorAlert message={queue.error || decide.error} onRetry={queue.refresh} />
      {queue.isLoading ? <SkeletonRows rows={4} columns={3} /> : requests.length === 0 ? <EmptyState message="Destek talebi bulunamadı." /> : (
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="w-full min-w-[680px] text-left text-xs">
            <thead className="bg-zinc-900/70 text-zinc-500">
              <tr><th className="px-3 py-3 font-medium">Konu</th><th className="px-3 py-3 font-medium">Açıklama</th><th className="px-3 py-3 font-medium">Durum</th><th className="px-3 py-3 text-right font-medium">İşlem</th></tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70 bg-zinc-950">
              {requests.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-3 text-zinc-200">{item.title}<p className="mt-1 text-[10px] text-zinc-600">{new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(item.createdAt))}</p></td>
                  <td className="whitespace-pre-wrap px-3 py-3 text-zinc-400">{item.details}</td>
                  <td className="px-3 py-3 text-zinc-400">{item.status}</td>
                  <td className="px-3 py-3 text-right">
                    {item.status === "Yanıt Bekliyor" && <span className="inline-flex gap-1">
                      <button type="button" aria-label="Destek talebini yanıtlandı olarak işaretle" disabled={decide.isPending} onClick={async () => { if (await decide.run({ id: item.id, decision: "approve" })) queue.refresh(); }} className="rounded border border-emerald-900 p-2 text-emerald-300 disabled:opacity-50"><Check size={14} /></button>
                      <button type="button" aria-label="Destek talebini reddet" disabled={decide.isPending} onClick={async () => { if (await decide.run({ id: item.id, decision: "reject" })) queue.refresh(); }} className="rounded border border-rose-900 p-2 text-rose-300 disabled:opacity-50"><X size={14} /></button>
                    </span>}
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
