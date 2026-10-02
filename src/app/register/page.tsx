"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ApiError } from "@/lib/api-client";
import { currentUser, login, registerCustomer, userDestination } from "@/lib/auth";
import { customerRegistrationSchema } from "@/lib/auth-schemas";
import { BrandLogo } from "@/components/BrandLogo";
import { Combobox } from "@/components/ui/Combobox";
import { useApiQuery } from "@/lib/use-api";
import { useAuth } from "@/components/providers/auth-provider";
import { FormField, FormFieldset, FormInput } from "@/components/ui/form";

type RegistrationField = "name" | "email" | "phone" | "city" | "district" | "password" | "passwordConfirmation";

export default function RegisterPage() {
  const router = useRouter();
  const { authenticate } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<RegistrationField, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: cities = [], error: citiesError, isLoading: citiesLoading } = useApiQuery<string[]>(["/locations/cities"], { list: true });
  const { data: districts = [], error: districtsError, isLoading: districtsLoading } = useApiQuery<string[]>(
    ["/locations/districts", city],
    { list: true, enabled: Boolean(city), query: { city } },
  );

  useEffect(() => {
    let active = true;
    currentUser().then((user) => {
      if (active) router.replace(userDestination(user));
    }).catch((reason: unknown) => {
      if (!active || (reason instanceof ApiError && reason.status === 401)) return;
      setError(reason instanceof Error ? reason.message : "API bağlantısı kurulamadı.");
    });
    return () => { active = false; };
  }, [router]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setFieldErrors({});
    const validated = customerRegistrationSchema.safeParse({
      fullName: name,
      email,
      phone,
      city,
      district,
      password,
      passwordConfirmation,
    });
    if (!validated.success) {
      const nextErrors: Partial<Record<RegistrationField, string>> = {};
      for (const issue of validated.error.issues) {
        const field = issue.path[0];
        if (
          (field === "fullName" || field === "email" || field === "phone" || field === "city" || field === "district"
            || field === "password" || field === "passwordConfirmation")
          && !nextErrors[field === "fullName" ? "name" : field]
        ) {
          nextErrors[field === "fullName" ? "name" : field] = issue.message;
        }
      }
      setFieldErrors(nextErrors);
      setError("Lütfen işaretli alanları kontrol edin.");
      return;
    }

    setIsSubmitting(true);
    try {
      await registerCustomer({
        fullName: validated.data.fullName,
        email: validated.data.email,
        password: validated.data.password,
        phone: validated.data.phone,
        city: validated.data.city,
        district: validated.data.district,
      });
      const user = await login({ email: validated.data.email, password: validated.data.password });
      authenticate(user);
      router.refresh();
      const next = new URLSearchParams(window.location.search).get("next");
      router.push(next?.startsWith("/") && !next.startsWith("//") ? next : "/shops");
    } catch (reason) {
      if (reason instanceof ApiError && Object.keys(reason.fieldErrors).length > 0) {
        const nextErrors: Partial<Record<RegistrationField, string>> = {};
        for (const [field, messages] of Object.entries(reason.fieldErrors)) {
          const key = field === "fullName" ? "name"
            : field === "password_confirmation" ? "passwordConfirmation"
              : field;
          if (
            (key === "name" || key === "email" || key === "phone" || key === "city" || key === "district"
              || key === "password" || key === "passwordConfirmation")
            && messages[0]
          ) {
            nextErrors[key] = messages[0];
          }
        }
        setFieldErrors(nextErrors);
      }
      setError(reason instanceof Error ? reason.message : "Hesap oluşturulamadı.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#09090b] px-4 py-8 text-zinc-100">
      <section className="w-full max-w-sm space-y-5 rounded-xl border border-zinc-800 bg-zinc-950 p-6">
        <div className="flex items-center gap-3">
          <BrandLogo size={40} className="rounded-lg" />
          <div><h1 className="text-base font-semibold">Müşteri hesabı oluştur</h1><p className="text-xs text-zinc-500">Dükkanları bulun ve randevu alın</p></div>
        </div>
        <form onSubmit={submit}>
          <FormFieldset className="space-y-3">
          <FormField label="Ad soyad" description="Hesabınızda görünecek ad ve soyadınızı girin.">
            <FormInput required minLength={2} maxLength={120} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} />
            {fieldErrors.name && <span className="mt-1 block text-[11px] text-rose-300">{fieldErrors.name}</span>}
          </FormField>
          <FormField label="E-posta" description="Randevu ve hesap bildirimleri bu adrese gönderilir.">
            <FormInput type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            {fieldErrors.email && <span className="mt-1 block text-[11px] text-rose-300">{fieldErrors.email}</span>}
          </FormField>
          <FormField label="Telefon" description="Randevu bilgilendirmeleri için telefon numaranızı girin.">
            <FormInput type="tel" required maxLength={40} autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
            {fieldErrors.phone && <span className="mt-1 block text-[11px] text-rose-300">{fieldErrors.phone}</span>}
          </FormField>
          <Combobox
            label="İl"
            description="Size yakın salonları bulmak için yaşadığınız ili seçin."
            options={cities}
            value={city}
            onChange={(value) => {
              setCity(value);
              setDistrict("");
              setFieldErrors((current) => ({ ...current, city: undefined, district: undefined }));
            }}
            placeholder={citiesLoading ? "İller yükleniyor..." : "İl seçin"}
            searchPlaceholder="İl ara..."
            disabled={citiesLoading || Boolean(citiesError)}
          />
            {fieldErrors.city && <span className="mt-1 block text-[11px] text-rose-300">{fieldErrors.city}</span>}
          <Combobox
            label="İlçe"
            description="Seçtiğiniz ile bağlı ilçeyi belirleyin."
            options={districts}
            value={district}
            onChange={(value) => {
              setDistrict(value);
              setFieldErrors((current) => ({ ...current, district: undefined }));
            }}
            placeholder={!city ? "Önce il seçin" : districtsLoading ? "İlçeler yükleniyor..." : "İlçe seçin"}
            searchPlaceholder="İlçe ara..."
            disabled={!city || districtsLoading || Boolean(districtsError)}
          />
            {fieldErrors.district && <span className="mt-1 block text-[11px] text-rose-300">{fieldErrors.district}</span>}
          {(citiesError || districtsError) && (
            <p role="alert" className="text-[11px] text-rose-300">{citiesError || districtsError}</p>
          )}
          <FormField label={<>Parola <span className="text-zinc-600">(en az 12 karakter)</span></>} description="En az 12 karakter uzunluğunda bir parola belirleyin.">
            <FormInput type="password" required minLength={12} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
            {fieldErrors.password && <span className="mt-1 block text-[11px] text-rose-300">{fieldErrors.password}</span>}
          </FormField>
          <FormField label="Parola tekrarı" description="Onaylamak için belirlediğiniz parolayı tekrar girin.">
            <FormInput type="password" required minLength={12} autoComplete="new-password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} />
            {fieldErrors.passwordConfirmation && <span className="mt-1 block text-[11px] text-rose-300">{fieldErrors.passwordConfirmation}</span>}
          </FormField>
          {error && <p role="alert" className="rounded-md border border-rose-900 bg-rose-950/30 p-3 text-xs text-rose-300">{error}</p>}
          <button type="submit" disabled={isSubmitting} className="h-10 w-full rounded-md bg-zinc-100 text-sm font-medium text-zinc-950 disabled:opacity-50">
            {isSubmitting ? "Hesap oluşturuluyor..." : "Hesap oluştur"}
          </button>
          </FormFieldset>
        </form>
        <p className="text-center text-xs text-zinc-500">
          Zaten hesabınız var mı? <Link href="/login" className="text-zinc-200 hover:text-white">Giriş yapın</Link>
        </p>
      </section>
    </main>
  );
}
