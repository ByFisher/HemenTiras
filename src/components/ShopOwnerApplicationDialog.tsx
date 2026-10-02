"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { registerShopOwner } from "@/lib/auth";
import { shopOwnerRegistrationSchema } from "@/lib/auth-schemas";
import { useApiQuery } from "@/lib/use-api";
import { Combobox } from "@/components/ui/Combobox";
import { FormField, FormFieldset, FormInput } from "@/components/ui/form";

type ApplicationFields = {
  name: string;
  email: string;
  phone: string;
  password: string;
  password_confirmation: string;
  shopName: string;
  city: string;
  district: string;
};

const initialFields: ApplicationFields = {
  name: "",
  email: "",
  phone: "",
  password: "",
  password_confirmation: "",
  shopName: "",
  city: "",
  district: "",
};

const fields: { key: keyof ApplicationFields; label: string; type?: string; autoComplete?: string }[] = [
  { key: "name", label: "Ad soyad", autoComplete: "name" },
  { key: "email", label: "E-posta", type: "email", autoComplete: "email" },
  { key: "shopName", label: "Dükkan adı" },
  { key: "phone", label: "Telefon", type: "tel", autoComplete: "tel" },
  { key: "password", label: "Parola (en az 12 karakter)", type: "password", autoComplete: "new-password" },
  { key: "password_confirmation", label: "Parola tekrarı", type: "password", autoComplete: "new-password" },
];

export function ShopOwnerApplicationDialog({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initialFields);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: cities = [], error: citiesError, isLoading: citiesLoading } = useApiQuery<string[]>(["/locations/cities"], { list: true });
  const { data: districts = [], error: districtsError, isLoading: districtsLoading } = useApiQuery<string[]>(
    ["/locations/districts", values.city],
    { list: true, enabled: Boolean(values.city), query: { city: values.city } },
  );

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const validated = shopOwnerRegistrationSchema.safeParse({
      fullName: values.name,
      email: values.email,
      password: values.password,
      passwordConfirmation: values.password_confirmation,
      shopName: values.shopName,
      phone: values.phone,
      city: values.city,
      district: values.district,
    });
    if (!validated.success) {
      setError(validated.error.issues[0]?.message ?? "Form bilgilerini kontrol edin.");
      return;
    }
    setIsSubmitting(true);

    try {
      await registerShopOwner({
        fullName: validated.data.fullName,
        email: validated.data.email,
        password: validated.data.password,
        shopName: validated.data.shopName,
        phone: validated.data.phone,
        city: validated.data.city,
        district: validated.data.district,
      });
      if (onSuccess) {
        onSuccess();
      } else {
        onClose();
        router.push("/approval-pending");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Başvuru gönderilemedi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !isSubmitting) onClose();
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="shop-application-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 p-5 text-left shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="shop-application-title" className="text-base font-semibold text-zinc-100">İşletmeni HemenTıraş’a ekle</h2>
            <p className="mt-1 text-xs text-zinc-500">Başvurunuz Süper Admin onayına gönderilir.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Formu kapat" className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"><X size={18} /></button>
        </div>
        <form onSubmit={submit}>
          <FormFieldset className="grid gap-3 sm:grid-cols-2">
            {fields.map((field) => (
              <FormField key={field.key} label={field.label} description={field.key === "password" || field.key === "password_confirmation" ? "En az 12 karakter kullanın." : "Başvuru bilgilerinizi girin."}>
                <FormInput
                  type={field.type ?? "text"}
                  required
                  minLength={field.key === "password" || field.key === "password_confirmation" ? 12 : undefined}
                  maxLength={field.key === "phone" ? 40 : field.key === "name" || field.key === "shopName" ? 120 : field.key === "password" || field.key === "password_confirmation" ? undefined : 255}
                  autoComplete={field.autoComplete}
                  value={values[field.key]}
                  onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                />
              </FormField>
            ))}
            <Combobox
              label="İl"
              description="İşletmenizin bulunduğu ili seçin."
              options={cities}
              value={values.city}
              onChange={(city) => setValues((current) => ({ ...current, city, district: "" }))}
              placeholder={citiesLoading ? "İller yükleniyor..." : "İl seçin"}
              searchPlaceholder="İl ara..."
              disabled={citiesLoading || Boolean(citiesError)}
            />
            <Combobox
              label="İlçe"
              description="İşletmenizin bulunduğu ilçeyi seçin."
              options={districts}
              value={values.district}
              onChange={(district) => setValues((current) => ({ ...current, district }))}
              placeholder={!values.city ? "Önce il seçin" : districtsLoading ? "İlçeler yükleniyor..." : "İlçe seçin"}
              searchPlaceholder="İlçe ara..."
              disabled={!values.city || districtsLoading || Boolean(districtsError)}
            />
          {(citiesError || districtsError) && (
            <p role="alert" className="text-xs text-rose-300">{citiesError || districtsError}</p>
          )}
          {error && <p role="alert" className="rounded-md border border-rose-900 bg-rose-950/30 p-3 text-xs text-rose-300">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" disabled={isSubmitting} onClick={onClose} className="h-10 rounded-md border border-zinc-800 px-4 text-xs text-zinc-300 disabled:opacity-50">Vazgeç</button>
            <button type="submit" disabled={isSubmitting} className="h-10 rounded-md bg-zinc-100 px-4 text-xs font-medium text-zinc-950 disabled:opacity-50">
              {isSubmitting ? "Başvuru gönderiliyor..." : "Başvuruyu gönder"}
            </button>
          </div>
          </FormFieldset>
        </form>
      </section>
    </div>
  );
}
