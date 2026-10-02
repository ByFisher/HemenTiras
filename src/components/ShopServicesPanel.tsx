"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { createShopService, getShopServices, updateShopServiceField } from "@/lib/shop-management-api";
import type { ShopService } from "@/types/portal";
import { FormField, FormInput, FormListbox } from "@/components/ui/form";

type EditableField = keyof Omit<ShopService, "id">;
type EditingCell = { serviceId: string; field: EditableField };

const editableFields: EditableField[] = ["name", "category", "description", "durationMinutes", "price", "status"];
const fieldLabel: Record<EditableField, string> = {
  name: "Hizmet adı",
  category: "Kategori",
  description: "Açıklama",
  durationMinutes: "Süre (dk)",
  price: "Fiyat (₺)",
  status: "Durum",
};

export function ShopServicesPanel() {
  const [services, setServices] = useState<ShopService[]>([]);
  const [categories, setCategories] = useState(["Saç", "Sakal", "Paket", "Bakım"]);
  const [loading, setLoading] = useState(true);
  const [savingCells, setSavingCells] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState("");
  const [adding, setAdding] = useState(false);
  const categoryOptions = useMemo(
    () => Array.from(new Set([...categories, ...services.map((service) => service.category)])),
    [categories, services],
  );

  useEffect(() => {
    let current = true;
    getShopServices().then((result) => {
      if (current) {
        setServices(result);
        setCategories((existing) => Array.from(new Set([...existing, ...result.map((service) => service.category)])));
      }
    }).catch((reason: unknown) => {
      if (current) setError(reason instanceof Error ? reason.message : "Hizmet listesi alınamadı.");
    }).finally(() => {
      if (current) setLoading(false);
    });
    return () => { current = false; };
  }, []);

  const startEdit = (service: ShopService, field: EditableField) => {
    setEditingCell({ serviceId: service.id, field });
    setEditValue(String(service[field]));
    setError("");
    setNotice("");
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue("");
  };

  const commitEdit = async (service: ShopService, field: EditableField, nextValue = editValue) => {
    if (editingCell?.serviceId !== service.id || editingCell.field !== field) return;
    const key = `${service.id}:${field}`;
    if (savingCells.includes(key)) return;
    let value: string | number | ShopService["status"] = nextValue.trim();
    if (field === "price" || field === "durationMinutes") {
      const numberValue = Number(nextValue);
      const minimum = field === "durationMinutes" ? 1 : 0;
      if (!Number.isFinite(numberValue) || numberValue < minimum) {
        setError(field === "price" ? "Fiyat sıfır veya daha büyük olmalıdır." : "Hizmet süresi en az 1 dakika olmalıdır.");
        return;
      }
      value = numberValue;
    } else if (field === "name" && !value) {
      setError("Hizmet adı boş bırakılamaz.");
      return;
    } else if (field === "category" && !value) {
      setError("Kategori adı boş bırakılamaz.");
      return;
    }

    if (String(value) === String(service[field])) {
      cancelEdit();
      return;
    }

    setSavingCells((current) => current.includes(key) ? current : [...current, key]);
    setError("");
    try {
      let updated: ShopService;
      if (field === "status") {
        if (value !== "active" && value !== "inactive") throw new Error("Hizmet durumu geçersiz.");
        updated = await updateShopServiceField(service.id, field, value);
      } else if (field === "price" || field === "durationMinutes") {
        if (typeof value !== "number") throw new Error("Sayısal hizmet alanı geçersiz.");
        updated = await updateShopServiceField(service.id, field, value);
      } else {
        if (typeof value !== "string") throw new Error("Hizmet metin alanı geçersiz.");
        updated = await updateShopServiceField(service.id, field, value);
      }
      setServices((current) => current.map((item) => item.id === service.id ? { ...item, [field]: updated[field] } : item));
      if (field === "category") {
        setCategories((current) => current.includes(String(value)) ? current : [...current, String(value)]);
      }
      setNotice(`${fieldLabel[field]} kaydedildi.`);
      setEditingCell((current) => current?.serviceId === service.id && current.field === field ? null : current);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `${fieldLabel[field]} kaydedilemedi.`);
    } finally {
      setSavingCells((current) => current.filter((cell) => cell !== key));
    }
  };

  const addService = async () => {
    setAdding(true);
    setError("");
    setNotice("");
    try {
      const created = await createShopService({
        name: "Yeni Hizmet",
        category: "Yeni Kategori",
        description: "",
        durationMinutes: 30,
        price: 0,
        status: "active",
      });
      setServices((current) => [created, ...current]);
      setCategories((current) => current.includes(created.category) ? current : [...current, created.category]);
      startEdit(created, "name");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Yeni hizmet oluşturulamadı.");
    } finally {
      setAdding(false);
    }
  };

  const addCategory = () => {
    const value = window.prompt("Yeni kategori adı")?.trim();
    if (!value) return;
    setCategories((current) => current.includes(value) ? current : [...current, value]);
    setNotice(`"${value}" kategorisi eklendi. Hizmet satırlarında kategori hücresinden seçebilirsiniz.`);
  };

  const renderCell = (service: ShopService, field: EditableField) => {
    const isEditing = editingCell?.serviceId === service.id && editingCell.field === field;
    const busy = savingCells.includes(`${service.id}:${field}`);
    if (isEditing) {
      if (field === "status") {
        return <FormListbox
          label={`${service.name} durumu`}
          description="Hizmetin müşterilere açık olup olmadığını belirleyin."
          value={editValue}
          onChange={(value) => { setEditValue(value); void commitEdit(service, field, value); }}
          clearable={false}
          options={[{ value: "active", label: "Aktif" }, { value: "inactive", label: "Pasif" }]}
          className="min-w-28"
        />;
      }
      return <FormField label={`${service.name} ${fieldLabel[field]}`} description={`${fieldLabel[field]} değerini güncelleyin.`}>
      <FormInput
        autoFocus
        aria-label={`${service.name} ${fieldLabel[field]}`}
        type={field === "price" || field === "durationMinutes" ? "number" : "text"}
        min={field === "durationMinutes" ? 1 : field === "price" ? 0 : undefined}
        maxLength={field === "description" ? 500 : field === "name" || field === "category" ? 120 : undefined}
        value={editValue}
        onChange={(event) => setEditValue(event.target.value)}
        onBlur={() => void commitEdit(service, field)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") cancelEdit();
        }}
        className="h-8 min-w-24 px-2 text-xs"
      />
      </FormField>;
    }

    let displayValue: string;
    if (field === "price") displayValue = service.price.toLocaleString("tr-TR");
    else if (field === "durationMinutes") displayValue = String(service.durationMinutes);
    else if (field === "status") displayValue = service.status === "active" ? "Aktif" : "Pasif";
    else if (field === "name") displayValue = service.name;
    else if (field === "category") displayValue = service.category;
    else displayValue = service.description;

    return <button
      type="button"
      disabled={busy}
      onClick={() => startEdit(service, field)}
      aria-label={`${fieldLabel[field]} düzenle: ${displayValue || "boş"}`}
      className={`min-h-8 w-full rounded px-2 py-1.5 text-left text-xs hover:bg-zinc-900 focus-visible:outline focus-visible:outline-1 focus-visible:outline-zinc-600 ${busy ? "animate-pulse text-zinc-500" : field === "status" && service.status === "active" ? "text-emerald-400" : "text-zinc-300"}`}
    >{displayValue || <span className="text-zinc-700">Düzenlemek için tıklayın</span>}</button>;
  };

  const activeCount = services.filter((service) => service.status === "active").length;
  const averagePrice = services.length ? Math.round(services.reduce((total, service) => total + service.price, 0) / services.length) : 0;

  return <section className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-3">
      {[["Hizmet", String(services.length)], ["Kategori", String(categoryOptions.length)], ["Ortalama fiyat", `₺${averagePrice.toLocaleString("tr-TR")}`]].map(([label, value]) => <article key={label} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4"><p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p><p className="mt-2 text-xl font-semibold tabular-nums text-zinc-100">{loading ? "…" : value}</p></article>)}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-sm font-medium text-zinc-200">Hizmet ve kategoriler</h2><p className="mt-1 text-xs text-zinc-500">Düzenlemek için hücreye tıklayın. Enter veya hücre dışına tıklama kaydeder; Escape iptal eder.</p></div>
      <div className="flex gap-2"><button type="button" onClick={addCategory} className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-300"><Plus size={13} />Kategori ekle</button><button type="button" disabled={adding} onClick={() => void addService()} className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-950 disabled:opacity-50"><Plus size={13} />{adding ? "Ekleniyor..." : "Hizmet ekle"}</button></div>
    </div>
    {error && <p role="alert" className="rounded-md border border-rose-900 bg-rose-950/30 p-3 text-xs text-rose-300">{error}<button type="button" onClick={() => setError("")} aria-label="Hata mesajını kapat" className="float-right"><X size={13} /></button></p>}
    {notice && <p role="status" className="rounded-md border border-emerald-900 bg-emerald-950/30 p-3 text-xs text-emerald-300">{notice}<button type="button" onClick={() => setNotice("")} aria-label="Bildirim mesajını kapat" className="float-right"><Check size={13} /></button></p>}
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
      {loading ? <p className="p-8 text-center text-xs text-zinc-500">Hizmetler yükleniyor...</p> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs">
        <thead><tr className="border-b border-zinc-800 bg-zinc-900/60 text-zinc-500">{editableFields.map((field) => <th key={field} className="px-2 py-3 font-medium">{fieldLabel[field]}</th>)}</tr></thead>
        <tbody className="divide-y divide-zinc-800/70">{services.map((service) => <tr key={service.id} className="hover:bg-zinc-900/30">
          {editableFields.map((field) => <td key={field} className="px-1.5 py-1.5">{renderCell(service, field)}</td>)}
        </tr>)}
        {services.length === 0 && <tr><td colSpan={editableFields.length} className="p-8 text-center text-xs text-zinc-500">Henüz hizmet yok. Hizmet ekle ile başlayın.</td></tr>}
        </tbody>
      </table></div>}
      <div className="border-t border-zinc-800 px-3 py-2 text-[10px] text-zinc-600">{activeCount} aktif · {services.length - activeCount} pasif hizmet</div>
    </div>
  </section>;
}
