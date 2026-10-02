import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Scissors,
  ShieldCheck,
  Sparkles,
  Store,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { LandingDiscovery } from "@/components/user/LandingDiscovery";
import { HeroSlider } from "@/components/user/HeroSlider";

const benefits = [
  { icon: Store, label: "Yakınındaki salonları keşfet" },
  { icon: Clock3, label: "Programına uyan saati bul" },
  { icon: ShieldCheck, label: "Randevunu güvenle yönet" },
];

export function LandingHero() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#080b0a] text-zinc-100">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-28rem] h-[54rem] w-[68rem] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.025)_38%,transparent_70%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:linear-gradient(to_bottom,black,transparent_80%)]" />
      </div>

      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <Link href="/" className="group inline-flex items-center gap-3" aria-label="HemenTıraş ana sayfa">
          <BrandLogo size={40} className="rounded-xl transition group-hover:scale-105" />
          <span className="text-sm font-semibold tracking-tight text-zinc-100">HemenTıraş</span>
        </Link>
        <nav aria-label="Hesap işlemleri" className="flex items-center gap-2">
          <Link
            href="/register"
            className="inline-flex h-10 items-center rounded-full border border-white/10 px-4 text-xs font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
          >
            Üye ol
          </Link>
          <Link
            href="/login"
            className="inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-4 text-xs font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
          >
            Giriş yap <ArrowRight size={14} />
          </Link>
        </nav>
      </header>

      <div className="pt-4 sm:pt-8">
        <HeroSlider />
        <LandingDiscovery />
      </div>
    </main>
  );
}
