"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { decideSponsorApprovalRequest, getSponsorApprovalQueue } from "@/lib/portal-api";
import type { SponsorApprovalRequest } from "@/types/portal";

export function SponsorApprovalQueue() {
  const [requests, setRequests] = useState<SponsorApprovalRequest[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const refresh = async () => {
    try {
      setRequests(await getSponsorApprovalQueue());
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Onay kuyruğu alınamadı.");
    }
  };

  useEffect(() => {
    let current = true;
    getSponsorApprovalQueue().then((result) => {
      if (current) setRequests(result);
    }).catch((reason: unknown) => {
      if (current) setError(reason instanceof Error ? reason.message : "Onay kuyruğu alınamadı.");
    });
    return () => { current = false; };
  }, []);

  const decide = async (request: SponsorApprovalRequest, decision: "approve" | "reject") => {
    setBusyId(request.id);
    setError("");
    try {
      await decideSponsorApprovalRequest(request.id, decision);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Talep güncellenemedi.");
    } finally {
      setBusyId("");
    }
  };

  return <section className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
    <div className="grid gap-3 border-b border-zinc-800 p-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ["Bekleyen talepler", requests.filter((request) => request.status === "Onay Bekliyor").length],
        ["Reklam", requests.filter((request) => request.kind === "campaign" && request.status === "Onay Bekliyor").length],
        ["Bütçe", requests.filter((request) => request.kind === "budget" && request.status === "Onay Bekliyor").length],
        ["Hedefleme", requests.filter((request) => request.kind === "targeting" && request.status === "Onay Bekliyor").length],
      ].map(([label, value]) => <article key={label} className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3"><p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums">{value}</p></article>)}
    </div>
    {error && <p role="alert" className="m-3 rounded-md border border-rose-900 bg-rose-950/30 p-3 text-xs text-rose-300">{error}</p>}
    {requests.length === 0 ? <p className="p-8 text-center text-xs text-zinc-500">Bekleyen sponsor talebi yok.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-xs">
      <thead><tr className="border-b border-zinc-800 bg-zinc-900/60 text-zinc-500"><th className="px-4 py-3 font-medium">Talep</th><th className="px-4 py-3 font-medium">Tür</th><th className="px-4 py-3 font-medium">İçerik</th><th className="px-4 py-3 font-medium">Durum</th><th className="px-4 py-3 text-right font-medium">İşlem</th></tr></thead>
      <tbody className="divide-y divide-zinc-800/70">{requests.map((request) => <tr key={request.id}>
        <td className="px-4 py-3 font-medium text-zinc-200">{request.title}</td><td className="px-4 py-3 capitalize text-zinc-400">{request.kind}</td><td className="px-4 py-3 text-zinc-400">{request.details}</td>
        <td className="px-4 py-3"><span className={`rounded border px-2 py-1 text-[10px] ${request.status === "Onay Bekliyor" ? "border-amber-900 bg-amber-950/40 text-amber-300" : request.status === "Onaylandı" ? "border-emerald-900 bg-emerald-950/40 text-emerald-300" : "border-rose-900 bg-rose-950/40 text-rose-300"}`}>{request.status}</span></td>
        <td className="px-4 py-3 text-right">{request.status === "Onay Bekliyor" && <span className="inline-flex gap-1"><button disabled={busyId === request.id} onClick={() => void decide(request, "approve")} className="rounded border border-emerald-900 px-2 py-1.5 text-emerald-300 disabled:opacity-50"><Check size={13} /></button><button disabled={busyId === request.id} onClick={() => void decide(request, "reject")} className="rounded border border-rose-900 px-2 py-1.5 text-rose-300 disabled:opacity-50"><X size={13} /></button></span>}</td>
      </tr>)}</tbody></table></div>}
  </section>;
}
