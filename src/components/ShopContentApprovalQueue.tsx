"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Check, ShieldCheck, X } from "lucide-react";
import { decideShopContentSubmission, getAdminContentApprovalQueue } from "@/lib/shop-management-api";
import type { ShopContentSubmission } from "@/types/portal";

const contentKindLabel: Record<ShopContentSubmission["kind"], string> = {
  profile_image: "Dükkan profil fotoğrafı",
  cover_image: "Dükkan kapak fotoğrafı",
  staff_profile: "Personel profili",
  staff_photo: "Personel fotoğrafı",
  shop_information: "Dükkan bilgisi",
  gallery_image: "Galeri fotoğrafı",
};

export function ShopContentApprovalQueue() {
  const [items, setItems] = useState<ShopContentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    let current = true;
    getAdminContentApprovalQueue().then((result) => {
      if (current) setItems(result);
    }).catch((reason: unknown) => {
      if (current) setError(reason instanceof Error ? reason.message : "Onay kuyruğu alınamadı.");
    }).finally(() => {
      if (current) setLoading(false);
    });
    return () => { current = false; };
  }, []);

  const decide = async (item: ShopContentSubmission, decision: "approved" | "rejected") => {
    setBusyId(item.id);
    setError("");
    try {
      await decideShopContentSubmission(item.id, decision);
      setItems((current) => current.filter((submission) => submission.id !== item.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Onay durumu kaydedilemedi.");
    } finally {
      setBusyId("");
    }
  };

  return <section className="space-y-4">
    <div className="flex items-center gap-2"><ShieldCheck size={16} className="text-emerald-400" /><div><h2 className="text-sm font-medium text-zinc-200">Fotoğraf & Personel Onay Kuyruğu</h2><p className="mt-1 text-xs text-zinc-500">Onaylanmayan içerikler müşteri tarafında yayınlanmaz.</p></div></div>
    {error && <p role="alert" className="rounded-md border border-rose-900 bg-rose-950/30 p-3 text-xs text-rose-300">{error}</p>}
    {loading ? <p className="rounded-lg border border-zinc-800 bg-zinc-950 p-8 text-center text-xs text-zinc-500">Onay talepleri yükleniyor...</p> : items.length === 0 ? <p className="rounded-lg border border-zinc-800 bg-zinc-950 p-8 text-center text-xs text-zinc-500">Bekleyen dükkan içeriği yok.</p> : <div className="grid gap-3 lg:grid-cols-2">
      {items.map((item) => <article key={item.id} className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
        {item.previewUrl && <div className="relative aspect-[2/1] bg-zinc-900"><Image src={item.previewUrl} alt={item.title} fill unoptimized sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" /></div>}
        <div className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><span className="rounded border border-amber-800 bg-amber-950/50 px-2 py-1 text-[10px] text-amber-200">⏳ Admin Onayı Bekliyor</span><h3 className="mt-3 text-sm font-medium text-zinc-100">{item.title}</h3><p className="mt-1 text-xs text-zinc-500">{contentKindLabel[item.kind]}</p></div><time className="text-[10px] text-zinc-600">{new Date(item.createdAt).toLocaleString("tr-TR")}</time></div>
          {item.kind === "shop_information" ? <pre className="mt-3 max-h-36 overflow-auto whitespace-pre-wrap break-words rounded bg-zinc-900 p-3 text-[10px] text-zinc-400">{(() => { try { return JSON.stringify(JSON.parse(item.description) as Record<string, unknown>, null, 2); } catch { return item.description; } })()}</pre> : <p className="mt-3 text-xs leading-relaxed text-zinc-400">{item.description}</p>}
          <div className="mt-4 flex justify-end gap-2"><button type="button" disabled={busyId === item.id} onClick={() => void decide(item, "rejected")} className="inline-flex items-center gap-1.5 rounded border border-rose-900 px-3 py-2 text-xs text-rose-300 disabled:opacity-50"><X size={13} />Reddet</button><button type="button" disabled={busyId === item.id} onClick={() => void decide(item, "approved")} className="inline-flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"><Check size={13} />{busyId === item.id ? "Kaydediliyor..." : "Onayla & yayınla"}</button></div>
        </div>
      </article>)}
    </div>}
  </section>;
}
