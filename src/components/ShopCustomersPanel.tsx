"use client";

import { useEffect, useMemo, useState } from "react";
import { LockKeyhole, ShieldCheck, UnlockKeyhole } from "lucide-react";
import { getShopCustomerContact, getShopCustomers } from "@/lib/portal-api";
import type { CustomerFilters } from "@/lib/portal-api";
import type { CustomerContact, ShopCustomer } from "@/types/portal";
import { FormField, FormFieldset, FormInput, FormListbox } from "@/components/ui/form";

function isContactEligible(customer: ShopCustomer) {
  const hasAppointmentToday = customer.appointmentStatus === "active"
    && customer.appointmentDate === new Date().toLocaleDateString("en-CA");
  return hasAppointmentToday || customer.hasContactConsent;
}

export function ShopCustomersPanel() {
  const [loadResult, setLoadResult] = useState<{ key: string; customers: ShopCustomer[]; error: string }>({ key: "", customers: [], error: "" });
  const [search, setSearch] = useState("");
  const [appointmentStatus, setAppointmentStatus] = useState<CustomerFilters["appointmentStatus"]>();
  const [revealed, setRevealed] = useState<Record<string, CustomerContact>>({});
  const queryKey = JSON.stringify([search, appointmentStatus]);
  const loading = loadResult.key !== queryKey;
  const customers = useMemo(() => loading ? [] : loadResult.customers, [loading, loadResult.customers]);
  const error = loading ? "" : loadResult.error;

  useEffect(() => {
    let current = true;
    getShopCustomers({ search, appointmentStatus }).then((result) => {
      if (current) setLoadResult({ key: queryKey, customers: result, error: "" });
    }).catch((reason: unknown) => {
      if (current) setLoadResult({ key: queryKey, customers: [], error: reason instanceof Error ? reason.message : "Müşteri listesi alınamadı." });
    });
    return () => { current = false; };
  }, [search, appointmentStatus, queryKey]);

  useEffect(() => {
    const timers = Object.values(revealed).map((contact) =>
      window.setTimeout(() => {
        setRevealed((current) => {
          const next = { ...current };
          for (const [id, value] of Object.entries(next)) {
            if (value.expiresAt === contact.expiresAt) delete next[id];
          }
          return next;
        });
      }, Math.max(0, new Date(contact.expiresAt).getTime() - Date.now())),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [revealed]);

  const metrics = useMemo(() => [
    { label: "Randevulu müşteri", value: customers.length },
    { label: "Bugün aktif randevu", value: customers.filter((customer) => isContactEligible(customer) && customer.appointmentStatus === "active").length },
    { label: "İletişim onayı", value: customers.filter((customer) => customer.hasContactConsent).length },
  ], [customers]);

  const revealContact = async (customer: ShopCustomer) => {
    try {
      const contact = await getShopCustomerContact(customer);
      setRevealed((current) => ({ ...current, [customer.id]: contact }));
    } catch (reason) {
      setLoadResult((current) => ({ ...current, error: reason instanceof Error ? reason.message : "İletişim bilgisi açılamadı." }));
    }
  };

  return <section className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-3">
      {metrics.map((metric) => <article key={metric.label} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4"><p className="text-[10px] uppercase tracking-wider text-zinc-500">{metric.label}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{metric.value}</p></article>)}
    </div>
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
      <FormFieldset className="flex flex-col gap-2 border-b border-zinc-800 p-3 sm:flex-row sm:items-end sm:justify-between">
        <FormField label="Müşteri ara" description="İlişkili randevusu olan müşterilerde arama yapın." className="sm:max-w-xs sm:flex-1">
          <FormInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Müşterilerde ara..." className="h-9" />
        </FormField>
        <FormListbox
          label="Randevu durumu"
          description="Müşteri listesini randevu durumuna göre filtreleyin."
          value={appointmentStatus ?? ""}
          onChange={(value) => setAppointmentStatus(value || undefined)}
          placeholder="Tüm randevular"
          options={[
            { value: "active", label: "Aktif randevu" },
            { value: "completed", label: "Geçmiş randevu" },
          ]}
          className="sm:w-56"
        />
      </FormFieldset>
      {error && <p role="alert" className="m-3 rounded-md border border-rose-900 bg-rose-950/30 p-3 text-xs text-rose-300">{error}</p>}
      {loading ? <p className="p-8 text-center text-xs text-zinc-500">Müşteriler yükleniyor...</p> : customers.length === 0 ? <p className="p-8 text-center text-xs text-zinc-500">Bu dükkanla ilişkili randevulu müşteri bulunamadı.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-xs">
            <thead><tr className="border-b border-zinc-800 bg-zinc-900/60 text-zinc-500"><th className="px-4 py-3 font-medium">Müşteri</th><th className="px-4 py-3 font-medium">Telefon</th><th className="px-4 py-3 font-medium">Son randevu</th><th className="px-4 py-3 font-medium">İzin</th><th className="px-4 py-3 text-right font-medium">İletişim erişimi</th></tr></thead>
            <tbody className="divide-y divide-zinc-800/70">{customers.map((customer) => {
              const contact = revealed[customer.id];
              const eligible = isContactEligible(customer);
              return <tr key={customer.id} className="hover:bg-zinc-900/40">
                <td className="px-4 py-3"><p className="font-medium text-zinc-200">{contact?.fullName ?? `${customer.firstName} ${customer.maskedSurname}`}</p><p className="mt-1 text-[10px] text-zinc-600">Yalnızca randevu ilişkisi olan müşteri</p></td>
                <td className="px-4 py-3 font-mono text-zinc-400">{contact?.phone ?? customer.maskedPhone}</td>
                <td className="px-4 py-3 text-zinc-400">{customer.lastAppointmentAt}</td>
                <td className="px-4 py-3">{customer.hasContactConsent ? <span className="inline-flex items-center gap-1 text-emerald-400"><ShieldCheck size={12} />Onaylı</span> : <span className="text-zinc-600">Onay yok</span>}</td>
                <td className="px-4 py-3 text-right">{eligible ? <button type="button" onClick={() => void revealContact(customer)} className="inline-flex items-center gap-1.5 rounded border border-zinc-700 px-2.5 py-1.5 text-zinc-300 hover:bg-zinc-800"><UnlockKeyhole size={12} />{contact ? "60 sn açık" : "Geçici görüntüle"}</button> : <span className="inline-flex items-center gap-1.5 text-zinc-600"><LockKeyhole size={12} />Erişim kapalı</span>}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      )}
      <p className="border-t border-zinc-800 px-4 py-3 text-[10px] leading-relaxed text-zinc-600">Telefon ve soyadı maskeli gösterilir. Tam iletişim bilgisi yalnızca bugünkü aktif randevuda veya müşteri onayıyla, geçici olarak açılır. Nihai kontrol API tarafından yapılmalıdır.</p>
    </div>
  </section>;
}
