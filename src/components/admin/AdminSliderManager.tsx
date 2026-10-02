"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from "lucide-react";
import { adminApi } from "@/lib/services";
import { ApiError } from "@/lib/api-client";
import { FormCheckboxField, FormField, FormFieldset, FormInput, FormTextarea } from "@/components/ui/form";
import type { AdminSlider } from "@/types/api";

type Editor = {
  id: string | null;
  title: string;
  description: string;
  linkUrl: string;
  linkLabel: string;
  isActive: boolean;
  image?: File;
};

const emptyEditor: Editor = {
  id: null,
  title: "",
  description: "",
  linkUrl: "",
  linkLabel: "",
  isActive: false,
};

function errorMessage(reason: unknown) {
  if (reason instanceof ApiError) {
    const fieldMessage = Object.values(reason.fieldErrors).flat()[0];
    return fieldMessage || reason.message;
  }
  return reason instanceof Error ? reason.message : "Slider işlemi tamamlanamadı.";
}

export function AdminSliderManager() {
  const [slides, setSlides] = useState<AdminSlider[]>([]);
  const [editor, setEditor] = useState<Editor>(emptyEditor);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    void adminApi.sliders()
      .then((items) => {
        if (!cancelled) setSlides(items);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(errorMessage(reason));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const edit = (slide: AdminSlider) => {
    setEditor({
      id: slide.id,
      title: slide.title,
      description: slide.description ?? "",
      linkUrl: slide.linkUrl ?? "",
      linkLabel: slide.linkLabel ?? "",
      isActive: slide.isActive,
    });
    setNotice("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const body = new FormData();
    body.set("title", editor.title.trim());
    body.set("description", editor.description.trim());
    body.set("link_url", editor.linkUrl.trim());
    body.set("link_label", editor.linkLabel.trim());
    body.set("is_active", editor.isActive ? "1" : "0");
    if (editor.image) body.set("image", editor.image);

    try {
      if (editor.id) {
        const updated = await adminApi.updateSlider(editor.id, body);
        setSlides((current) => current.map((slide) => slide.id === updated.id ? updated : slide).sort((a, b) => a.sortOrder - b.sortOrder));
        setNotice("Banner güncellendi.");
      } else {
        if (!editor.image) {
          setError("Yeni banner için bir görsel seçin.");
          return;
        }
        const created = await adminApi.createSlider(body);
        setSlides((current) => [...current, created].sort((a, b) => a.sortOrder - b.sortOrder));
        setNotice("Banner eklendi.");
      }
      setEditor(emptyEditor);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (slide: AdminSlider) => {
    setError("");
    try {
      const updated = await adminApi.setSliderActive(slide.id, !slide.isActive);
      setSlides((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (reason) {
      setError(errorMessage(reason));
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const destination = index + direction;
    if (destination < 0 || destination >= slides.length) return;
    const reordered = [...slides];
    [reordered[index], reordered[destination]] = [reordered[destination], reordered[index]];
    setError("");
    try {
      setSlides(await adminApi.reorderSliders(reordered.map((slide) => slide.id)));
    } catch (reason) {
      setError(errorMessage(reason));
    }
  };

  const remove = async (slide: AdminSlider) => {
    if (!window.confirm(`"${slide.title}" bannerı silinsin mi?`)) return;
    setError("");
    try {
      await adminApi.deleteSlider(slide.id);
      setSlides((current) => current.filter((item) => item.id !== slide.id));
      if (editor.id === slide.id) setEditor(emptyEditor);
      setNotice("Banner silindi.");
    } catch (reason) {
      setError(errorMessage(reason));
    }
  };

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-medium text-zinc-200">Ana sayfa bannerları</h2>
          <p className="mt-1 text-xs text-zinc-500">Aktif bannerlar sıralı gösterilir. Tek aktif banner sabit kalır; birden fazlası otomatik döner.</p>
        </div>
        {error && <p role="alert" className="rounded-md border border-rose-900 bg-rose-950/30 p-3 text-xs text-rose-300">{error}</p>}
        {notice && <p role="status" className="rounded-md border border-zinc-700 bg-zinc-900 p-3 text-xs text-zinc-200">{notice}</p>}
        {loading ? <p className="rounded-lg border border-zinc-800 p-8 text-center text-xs text-zinc-500">Bannerlar yükleniyor...</p> : slides.length === 0 ? (
          <p className="rounded-lg border border-zinc-800 p-8 text-center text-xs text-zinc-500">Henüz banner eklenmedi.</p>
        ) : slides.map((slide, index) => (
          <article key={slide.id} className="grid gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3 sm:grid-cols-[9rem_minmax(0,1fr)_auto]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={slide.imageUrl} alt="" className="aspect-video h-full w-full rounded-md bg-zinc-900 object-cover" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-xs font-medium text-zinc-100">{slide.title}</h3>
                <span className={`rounded border px-1.5 py-0.5 text-[9px] ${slide.isActive ? "border-zinc-600 text-zinc-200" : "border-zinc-800 text-zinc-500"}`}>{slide.isActive ? "Aktif" : "Pasif"}</span>
                <span className="text-[10px] text-zinc-600">Sıra {slide.sortOrder + 1}</span>
              </div>
              {slide.description && <p className="mt-1 line-clamp-2 text-[11px] text-zinc-500">{slide.description}</p>}
              {slide.linkUrl && <p className="mt-1 truncate text-[10px] text-zinc-600">{slide.linkUrl}</p>}
              <div className="mt-2 flex flex-wrap gap-3">
                <button type="button" onClick={() => void toggleActive(slide)} className="text-[10px] text-zinc-300 underline">{slide.isActive ? "Pasife al" : "Aktifleştir"}</button>
                <button type="button" onClick={() => edit(slide)} className="text-[10px] text-zinc-300 underline">Düzenle</button>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:flex-col">
              <button type="button" aria-label="Yukarı taşı" disabled={index === 0} onClick={() => void move(index, -1)} className="rounded border border-zinc-800 p-2 text-zinc-400 hover:bg-zinc-900 disabled:opacity-30"><ArrowUp size={14} /></button>
              <button type="button" aria-label="Aşağı taşı" disabled={index === slides.length - 1} onClick={() => void move(index, 1)} className="rounded border border-zinc-800 p-2 text-zinc-400 hover:bg-zinc-900 disabled:opacity-30"><ArrowDown size={14} /></button>
              <button type="button" aria-label="Bannerı sil" onClick={() => void remove(slide)} className="rounded border border-zinc-800 p-2 text-rose-300 hover:bg-rose-950/30"><Trash2 size={14} /></button>
            </div>
          </article>
        ))}
      </div>

      <form onSubmit={(event) => void submit(event)} className="h-fit rounded-lg border border-zinc-800 bg-zinc-950 p-4">
        <FormFieldset className="space-y-4">
          <div>
            <h2 className="text-sm font-medium text-zinc-200">{editor.id ? "Bannerı düzenle" : "Banner ekle"}</h2>
            <p className="mt-1 text-[10px] text-zinc-600">Görsel en fazla 5 MB, JPG, PNG veya WebP olabilir.</p>
          </div>
          <FormField label="Başlık" description="Banner üzerinde öne çıkacak ana mesaj.">
            <FormInput required maxLength={160} value={editor.title} onChange={(event) => setEditor((current) => ({ ...current, title: event.target.value }))} placeholder="Örn. Yeni sezon, yeni tarz" />
          </FormField>
          <FormField label="Açıklama" description="Başlığın altında görünecek kısa açıklama.">
            <FormTextarea maxLength={1000} value={editor.description} onChange={(event) => setEditor((current) => ({ ...current, description: event.target.value }))} />
          </FormField>
          <FormField label="Banner görseli" description={editor.id ? "Görsel seçmezseniz mevcut görsel kullanılır." : "Yeni banner için görsel gereklidir."}>
            <FormInput type="file" accept="image/jpeg,image/png,image/webp" required={!editor.id} onChange={(event) => setEditor((current) => ({ ...current, image: event.target.files?.[0] }))} className="text-xs file:mr-3 file:rounded file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-xs file:text-zinc-200" />
          </FormField>
          <FormField label="Yönlendirme adresi" description="Site içi yol (/shops) veya HTTP(S) URL girin.">
            <FormInput type="text" maxLength={2048} value={editor.linkUrl} onChange={(event) => setEditor((current) => ({ ...current, linkUrl: event.target.value }))} placeholder="/shops" />
          </FormField>
          <FormField label="Buton metni" description="Yönlendirme butonunda görünecek metin.">
            <FormInput maxLength={80} value={editor.linkLabel} onChange={(event) => setEditor((current) => ({ ...current, linkLabel: event.target.value }))} placeholder="Salonları keşfet" />
          </FormField>
          <FormCheckboxField label="Aktif banner" description="Aktif bannerlar ana sayfada gösterilir." checked={editor.isActive} onChange={(isActive) => setEditor((current) => ({ ...current, isActive }))} />
          <div className="flex justify-end gap-2">
            {editor.id && <button type="button" onClick={() => setEditor(emptyEditor)} className="rounded-md border border-zinc-800 px-3 py-2 text-xs text-zinc-300">Vazgeç</button>}
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-950 disabled:opacity-50">
              <ImagePlus size={14} />{saving ? "Kaydediliyor..." : editor.id ? "Değişiklikleri kaydet" : "Banner ekle"}
            </button>
          </div>
        </FormFieldset>
      </form>
    </section>
  );
}
