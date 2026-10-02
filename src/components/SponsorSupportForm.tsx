"use client";

import { useState } from "react";
import { Send, ShieldCheck } from "lucide-react";
import { submitSponsorApprovalRequest } from "@/lib/portal-api";
import { FormField, FormFieldset, FormTextarea } from "@/components/ui/form";

export function SponsorSupportForm() {
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSending(true);
    setError("");
    setNotice("");
    try {
      await submitSponsorApprovalRequest({
        kind: "support",
        title: "Sponsor destek talebi",
        details: message.trim(),
      });
      setMessage("");
      setNotice("Talebiniz yalnızca Süper Admin destek kuyruğuna iletildi.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Destek talebi iletilemedi.");
    } finally {
      setSending(false);
    }
  };

  return <section className="max-w-2xl space-y-4">
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 text-emerald-400" size={18} /><div><h2 className="text-sm font-medium text-zinc-100">Süper Admin Destek & İletişim</h2><p className="mt-1 text-xs leading-relaxed text-zinc-500">Sponsorlar dükkanlara veya müşterilere mesaj gönderemez ve iletişim bilgilerini görüntüleyemez. Bu form yalnızca yetkili Süper Admin ekibine talep iletir.</p></div></div>
      <form onSubmit={submit} className="mt-5">
        <FormFieldset className="space-y-3">
        <FormField label="Destek talebiniz" description="Talebinizi en az 8 karakterle açıklayın; yalnızca Süper Admin ekibi görebilir.">
          <FormTextarea required minLength={8} maxLength={2000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Kampanya veya hesabınızla ilgili konuyu açıklayın." />
        </FormField>
        <button disabled={sending} className="inline-flex items-center gap-2 rounded-md bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-950 disabled:opacity-50"><Send size={13} />{sending ? "İletiliyor..." : "Süper Admin'e ilet"}</button>
        {notice && <p role="status" className="text-xs text-emerald-400">{notice}</p>}
        {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
        </FormFieldset>
      </form>
    </div>
  </section>;
}
