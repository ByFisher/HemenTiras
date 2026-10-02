"use client";

import { useEffect } from "react";
import { BrandLogo } from "@/components/BrandLogo";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/** Route segment'lerinin tamamını sarar (root layout'ın altında). */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("HemenTıraş panel hatası:", error);
  }, [error]);

  return (
    <html lang="tr" className="h-full dark">
      <body className="min-h-full bg-[#09090b] font-sans text-zinc-100">
        <main role="alert" className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 p-6 text-center">
          <BrandLogo size={64} />
          <h1 className="text-lg font-semibold">Bir şeyler ters gitti</h1>
          <p className="text-xs leading-relaxed text-zinc-400">
            {error.message || "Beklenmeyen bir hata oluştu. Veritabanı bağlantısı veya API erişimi kesilmiş olabilir."}
          </p>
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-zinc-100 px-4 py-2 text-xs font-medium text-zinc-950 hover:bg-white"
          >
            Sayfayı yeniden dene
          </button>
        </main>
      </body>
    </html>
  );
}
