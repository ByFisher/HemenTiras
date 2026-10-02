"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { currentUser, login, userDestination } from "@/lib/auth";
import { ApiError } from "@/lib/api-client";
import { BrandLogo } from "@/components/BrandLogo";
import { FormField, FormFieldset, FormInput } from "@/components/ui/form";
import { useAuth } from "@/components/providers/auth-provider";

export default function LoginPage() {
  const router = useRouter();
  const { authenticate } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    setIsSubmitting(true);
    setError("");
    try {
      const user = await login({ email: email.trim(), password });
      authenticate(user);
      router.refresh();
      const next = new URLSearchParams(window.location.search).get("next");
      const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : null;
      router.push(user.role === "customer" && safeNext ? safeNext : userDestination(user));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Giriş yapılamadı.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#09090b] px-4 text-zinc-100">
      <section className="w-full max-w-sm space-y-5 rounded-xl border border-zinc-800 bg-zinc-950 p-6">
        <div className="flex items-center gap-3">
          <BrandLogo size={40} className="rounded-lg" />
          <div><h1 className="text-base font-semibold">HemenTıraş</h1><p className="text-xs text-zinc-500">Hesabınızla giriş yapın</p></div>
        </div>
        <form onSubmit={submit}>
          <FormFieldset className="space-y-4">
            <FormField label="E-posta" description="Hesabınızla ilişkili e-posta adresini girin.">
              <FormInput type="email" required autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} />
            </FormField>
            <FormField label="Parola" description="Hesap parolanızı girin.">
              <FormInput type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </FormField>
            {error && <p role="alert" className="rounded-md border border-rose-900 bg-rose-950/30 p-3 text-xs text-rose-300">{error}</p>}
            <button type="submit" disabled={isSubmitting} className="h-10 w-full rounded-md bg-zinc-100 text-sm font-medium text-zinc-950 disabled:opacity-50">
              {isSubmitting ? "Giriş yapılıyor..." : "Giriş yap"}
            </button>
          </FormFieldset>
        </form>
        <p className="text-center text-xs text-zinc-500">
          Hesabınız yok mu? <Link href="/register" className="text-zinc-200 hover:text-white">Müşteri hesabı oluşturun</Link>
        </p>
      </section>
    </main>
  );
}
