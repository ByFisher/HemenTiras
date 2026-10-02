import Link from "next/link";
import { Clock3 } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

export default function ApprovalPendingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#09090b] px-4 text-zinc-100">
      <section className="w-full max-w-lg space-y-5 rounded-xl border border-zinc-800 bg-zinc-950 p-7 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-amber-900 bg-amber-950/30 text-amber-300"><Clock3 size={22} /></span>
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2 text-sm font-semibold"><BrandLogo size={32} /> HemenTıraş</div>
          <h1 className="text-lg font-semibold">Başvurunuz alındı</h1>
          <p className="text-sm leading-6 text-zinc-400">
            Başvurunuz alındı. Süper Admin onayından sonra panelinize erişebilirsiniz.
          </p>
        </div>
        <Link href="/login" className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-100 px-5 text-xs font-medium text-zinc-950 hover:bg-white">
          Başvuru durumunu kontrol etmek için giriş yapın
        </Link>
      </section>
    </main>
  );
}
