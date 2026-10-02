"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ImagePlus, MapPin, Save, Upload } from "lucide-react";
import { createShopContentSubmission, getShopContentSubmissions, getShopProfile, uploadShopContentImage } from "@/lib/shop-management-api";
import type { ShopContentSubmission } from "@/types/portal";
import { FormField, FormFieldset, FormInput, FormTextarea } from "@/components/ui/form";

type ImageKind = "profile_image" | "cover_image";

export function ShopProfilePanel() {
  const [profileImage, setProfileImage] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [submissions, setSubmissions] = useState<ShopContentSubmission[]>([]);
  const [form, setForm] = useState({ name: "", phone: "", address: "", description: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let current = true;
    Promise.all([getShopContentSubmissions(), getShopProfile()]).then(([result, profile]) => {
      if (current) {
        setSubmissions(result);
        setProfileImage(profile.profileImageUrl ?? "");
        setCoverImage(profile.coverImageUrl ?? "");
        setForm({
          name: profile.name,
          phone: profile.phone ?? "",
          address: profile.address,
          description: profile.description,
        });
      }
    }).catch((reason: unknown) => {
      if (current) setError(reason instanceof Error ? reason.message : "Profil içerikleri alınamadı.");
    });
    return () => { current = false; };
  }, []);

  const upload = async (file: File | undefined, kind: ImageKind) => {
    if (!file) return;
    setError("");
    setNotice("");
    try {
      const submission = await uploadShopContentImage(file, kind, kind === "profile_image" ? "Dükkan profil fotoğrafı" : "Dükkan kapak fotoğrafı");
      setSubmissions((current) => [submission, ...current.filter((item) => item.id !== submission.id)]);
      if (submission.previewUrl) {
        if (kind === "profile_image") setProfileImage(submission.previewUrl);
        else setCoverImage(submission.previewUrl);
      }
      setNotice("Görsel admin onayına gönderildi. Onaylanana kadar müşteri tarafında yayınlanmaz.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Görsel yüklenemedi.");
    }
  };

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const submission = await createShopContentSubmission({
        kind: "shop_information",
        title: "Dükkan profili değişikliği",
        description: "Dükkan profil bilgileri değişikliği.",
        payload: form,
      });
      setSubmissions((current) => [submission, ...current]);
      setNotice("Profil bilgileri admin onayına iletildi. Değişiklikler onaydan sonra yayınlanır.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Profil değişikliği gönderilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const pending = (kind: ImageKind) => submissions.find((item) => item.kind === kind && item.approvalStatus === "pending_approval");

  const imageUpload = (kind: ImageKind, preview: string, label: string) => (
    <FormField label={label} description={kind === "profile_image" ? "Kare profil veya logo görseli yükleyin." : "Dükkanınız için kapak görseli yükleyin."} className="group relative flex cursor-pointer flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
      <label className="cursor-pointer">
        <div className={`${kind === "profile_image" ? "aspect-square max-h-56" : "aspect-[2.6/1]"} relative flex items-center justify-center overflow-hidden bg-zinc-900`}>
          {preview ? <Image src={preview} alt={label} fill crossOrigin="use-credentials" unoptimized sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" /> : <ImagePlus size={28} className="text-zinc-600" />}
          <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100"><Upload size={14} className="mr-2" />Yeni görsel seç</span>
          {pending(kind) && <span className="absolute left-2 top-2 rounded-md border border-amber-700/70 bg-amber-950/90 px-2 py-1 text-[10px] font-medium text-amber-200">⏳ Admin Onayı Bekliyor</span>}
        </div>
        <div className="border-t border-zinc-800 px-3 py-2"><p className="text-xs font-medium text-zinc-200">{label}</p><p className="mt-1 text-[10px] text-zinc-600">{kind === "profile_image" ? "Kare profil / logo görseli" : "Dükkan kapak fotoğrafı"}</p></div>
        <FormInput type="file" accept="image/*" className="sr-only" onChange={(event) => void upload(event.target.files?.[0], kind)} />
      </label>
    </FormField>
  );

  return <section className="space-y-4">
    {error && <p role="alert" className="rounded-md border border-rose-900 bg-rose-950/30 p-3 text-xs text-rose-300">{error}</p>}
    {notice && <p role="status" className="rounded-md border border-emerald-900 bg-emerald-950/30 p-3 text-xs text-emerald-300">{notice}</p>}
    <div className="grid gap-4 md:grid-cols-[220px_1fr]">
      {imageUpload("profile_image", profileImage, "Profil / Logo Fotoğrafı")}
      {imageUpload("cover_image", coverImage, "Arka Plan / Kapak Fotoğrafı")}
    </div>
    <form onSubmit={saveProfile}>
      <FormFieldset className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
        <h2 className="text-sm font-medium">Dükkan bilgileri</h2>
        <FormField label="Dükkan adı" description="Müşterilerin dükkanınızı tanıyacağı adı girin."><FormInput required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></FormField>
        <FormField label="Telefon" description="Müşterilerin dükkanla iletişim kurabileceği telefon numarası."><FormInput required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></FormField>
        <FormField label="Adres" description="Dükkanın müşteriler tarafından ziyaret edilebilecek açık adresini yazın."><FormTextarea required value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></FormField>
        <FormField label="Dükkan açıklaması" description="Dükkanınız ve sunduğunuz deneyim hakkında kısa bilgi verin."><FormTextarea maxLength={1000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></FormField>
        <button disabled={saving} className="rounded bg-zinc-100 px-3 py-2 text-xs text-zinc-950 disabled:opacity-50"><Save size={12} className="mr-1 inline" />{saving ? "Onaya iletiliyor..." : "Değişiklikleri onaya gönder"}</button>
      </div>
      <div className="flex min-h-52 flex-col items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 p-5 text-center"><MapPin className="text-emerald-500" /><p className="mt-2 text-xs text-zinc-400">{form.address}</p><p className="mt-3 text-[10px] text-zinc-600">Kritik profil değişiklikleri admin onayı sonrası müşteri tarafında yayınlanır.</p></div>
      </FormFieldset>
    </form>
  </section>;
}
