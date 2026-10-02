"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Camera, X } from "lucide-react";
import { profileApi } from "@/lib/services";
import type { User } from "@/types/api";
import { FormField, FormFieldset, FormInput } from "@/components/ui/form";

export function EditProfileModal({
  user,
  onClose,
  onSaved,
}: {
  user: User;
  onClose: () => void;
  onSaved: (user: User) => void;
}) {
  const [fullName, setFullName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [avatar, setAvatar] = useState<File>();
  const [preview, setPreview] = useState(user.avatarUrl ?? "");
  const previewUrl = useRef<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => () => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
  }, []);

  const chooseAvatar = (file?: File) => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = file ? URL.createObjectURL(file) : null;
    setAvatar(file);
    setPreview(previewUrl.current ?? user.avatarUrl ?? "");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = fullName.trim();
    if (trimmedName.length < 2) {
      setError("Ad soyad en az 2 karakter olmalıdır.");
      return;
    }
    if (avatar && avatar.size > 3 * 1024 * 1024) {
      setError("Profil fotoğrafı en fazla 3 MB olabilir.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const updated = await profileApi.update({ fullName: trimmedName, phone: phone.trim(), avatar });
      onSaved(updated);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Profil güncellenemedi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}
    >
      <section role="dialog" aria-modal="true" aria-labelledby="edit-profile-title" className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 id="edit-profile-title" className="text-sm font-semibold text-zinc-100">Profili düzenle</h2>
            <p className="mt-1 text-xs text-zinc-500">Hesap bilgilerinizi güncelleyin.</p>
          </div>
          <button type="button" disabled={saving} onClick={onClose} aria-label="Profili düzenlemeyi kapat" className="rounded p-1.5 text-zinc-500 hover:bg-zinc-900 hover:text-white"><X size={16} /></button>
        </div>
        <form onSubmit={(event) => void submit(event)}>
          <FormFieldset className="space-y-4">
          <FormField label="Profil fotoğrafı" description="JPG, PNG veya WebP · En fazla 3 MB">
            <label className="flex cursor-pointer items-center gap-3">
              <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-zinc-700 bg-zinc-900">
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="" className="h-full w-full object-cover" />
                ) : <Camera size={18} className="text-zinc-500" />}
              </span>
              <span className="text-xs text-zinc-300">Yeni fotoğraf seçin</span>
              <FormInput
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => chooseAvatar(event.target.files?.[0])}
              />
            </label>
          </FormField>
          <FormField label="Ad soyad" description="Profilinizde görünecek adı girin.">
            <FormInput required minLength={2} maxLength={120} value={fullName} onChange={(event) => setFullName(event.target.value)} />
          </FormField>
          <FormField label="Telefon numarası" description="Randevularla ilgili bilgilendirmeler için telefon numaranızı ekleyin.">
            <FormInput type="tel" maxLength={40} value={phone} onChange={(event) => setPhone(event.target.value)} />
          </FormField>
          {error && <p role="alert" className="rounded-md border border-rose-900 bg-rose-950/30 p-3 text-xs text-rose-300">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-zinc-800 pt-4">
            <button type="button" disabled={saving} onClick={onClose} className="rounded-md border border-zinc-800 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-900 disabled:opacity-50">Vazgeç</button>
            <button type="submit" disabled={saving} className="rounded-md bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-950 hover:bg-white disabled:opacity-50">{saving ? "Kaydediliyor..." : "Değişiklikleri kaydet"}</button>
          </div>
          </FormFieldset>
        </form>
      </section>
    </div>
  );
}
