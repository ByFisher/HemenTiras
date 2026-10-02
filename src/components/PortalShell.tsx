"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  Command,
  Menu,
  Megaphone,
  Moon,
  Search,
  Scissors,
  Store,
  Sun,
  X,
} from "lucide-react";
import { NAVIGATION, PORTAL_HOME, PORTAL_ROLE_LABEL } from "@/data/portal";
import { currentUser, logout, userDestination } from "@/lib/auth";
import { ApiError } from "@/lib/api-client";
import type { User } from "@/types/api";
import type { PortalRole } from "@/types/portal";
import { BrandLoading, BrandLogo } from "@/components/BrandLogo";
import { UserDropdown } from "@/components/header/user-dropdown";
import { NotificationProvider } from "@/components/providers/notification-provider";
import { FormField, FormFieldset, FormInput } from "@/components/ui/form";

function PortalShellContent({ children, role }: { children: React.ReactNode; role: PortalRole }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const navGroups = useMemo(() => NAVIGATION[role]
    .map((group) => ({
      ...group,
      links: group.links.filter((item) => !item.allowedRoles || (user && item.allowedRoles.includes(user.role))),
    }))
    .filter((group) => group.links.length > 0), [role, user]);
  const links = useMemo(() => navGroups.flatMap((group) => group.links), [navGroups]);
  const matches = links.filter((item) => item.label.toLocaleLowerCase("tr-TR").includes(query.toLocaleLowerCase("tr-TR")));

  useEffect(() => {
    let active = true;
    currentUser().then((currentUser) => {
      if (!active) return;
      const expectedRoles = role === "admin" ? ["super_admin", "admin", "moderator"] : role === "shop" ? ["shop_owner"] : ["sponsor"];
      if (!expectedRoles.includes(currentUser.role)) {
        router.replace(userDestination(currentUser));
        return;
      }
      if (role === "shop" && currentUser.status === "pending_approval") {
        router.replace("/approval-pending");
        return;
      }
      setUser(currentUser);
    }).catch((reason: unknown) => {
      if (!active) return;
      if (reason instanceof ApiError && reason.status === 401) {
        router.replace("/login");
      } else {
        setAuthError(reason instanceof Error ? reason.message : "Oturum doğrulanamadı.");
      }
    });
    return () => { active = false; };
  }, [role, router]);

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
  }, [theme]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const signOut = async () => {
    try {
      await logout();
      router.replace("/login");
    } catch (reason) {
      setAuthError(reason instanceof Error ? reason.message : "Oturum kapatılamadı.");
    }
  };
  const roleLabel = role === "admin"
    ? user?.role === "super_admin" ? "Süper Admin" : user?.role === "moderator" ? "Moderatör" : "Admin"
    : PORTAL_ROLE_LABEL[role];

  if (authError) {
    return <main className="flex min-h-screen items-center justify-center bg-[#09090b] p-6 text-zinc-100">
      <div className="max-w-md space-y-3 rounded-xl border border-zinc-800 bg-zinc-950 p-5">
        <h1 className="text-sm font-semibold">Oturum doğrulanamadı</h1>
        <p role="alert" className="text-xs text-rose-300">{authError}</p>
        <button type="button" onClick={() => router.refresh()} className="rounded border border-zinc-700 px-3 py-2 text-xs">Yeniden dene</button>
      </div>
    </main>;
  }

  if (!user) return <BrandLoading label="Oturum doğrulanıyor..." />;

  return (
    <div className="flex h-dvh overflow-hidden bg-[#09090b] text-zinc-100">
      {menuOpen && <button type="button" aria-label="Menüyü kapat" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-40 bg-black/60 md:hidden" />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-zinc-800 bg-zinc-950 transition-transform md:static md:translate-x-0 ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between border-b border-zinc-800 p-4">
          <Link href={PORTAL_HOME[role]} className="flex items-center gap-2.5">
            <BrandLogo size={32} className="rounded-md" />
            <span><span className="block text-sm font-semibold">HemenTıraş <span className="ml-1 rounded border border-zinc-800 bg-zinc-900 px-1 text-[10px] font-normal text-zinc-500">OPS</span></span><span className="text-[10px] text-zinc-500">Yönetim Portalı</span></span>
          </Link>
          <button type="button" aria-label="Gezinme menüsünü kapat" onClick={() => setMenuOpen(false)} className="rounded p-1 text-zinc-500 hover:bg-zinc-800 md:hidden"><X size={17} /></button>
        </div>
        <div className="border-b border-zinc-800 p-3">
          <div className="rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2">
            <p className="truncate text-xs font-medium text-zinc-200">{role === "admin" ? "HemenTıraş" : role === "shop" ? user.shopName ?? user.fullName : user.fullName}</p>
            <p className="mt-0.5 text-[10px] text-zinc-500">{roleLabel}</p>
          </div>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {navGroups.map((group) => (
            <section key={group.label}>
              <h2 className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">{group.label}</h2>
              <div className="space-y-0.5">
                {group.links.map((item) => {
                  const active = pathname === item.href;
                  const Icon = item.icon;
                  return <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} aria-current={active ? "page" : undefined} className={`flex items-center justify-between rounded-md px-2.5 py-2 text-xs transition-colors ${active ? "bg-zinc-800 font-semibold text-zinc-100" : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"}`}>
                    <span className="flex items-center gap-2.5"><Icon size={15} />{item.label}</span>{item.badge && <span className="rounded bg-amber-950 px-1.5 py-0.5 font-mono text-[10px] text-amber-400">{item.badge}</span>}
                  </Link>;
                })}
              </div>
            </section>
          ))}
        </nav>
        <div className="border-t border-zinc-800 p-3">
          <div className="flex items-center gap-2.5 rounded-md px-2 py-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-xs text-zinc-300">{user.fullName.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
            <span className="min-w-0"><span className="block truncate text-xs font-medium text-zinc-300">{user.fullName}</span><span className="block truncate text-[10px] text-zinc-600">{user.shopName ?? roleLabel}</span></span>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="z-30 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-950/90 px-3 backdrop-blur sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <button type="button" onClick={() => setMenuOpen(true)} aria-label="Gezinme menüsünü aç" className="rounded-md p-2 text-zinc-400 hover:bg-zinc-900 md:hidden"><Menu size={18} /></button>
            <div className="hidden items-center gap-1.5 text-xs sm:flex"><span className="text-zinc-500">{roleLabel}</span><ChevronRight size={12} className="text-zinc-700" /><span className="truncate text-zinc-200">{links.find((link) => link.href === pathname)?.label ?? "Panel"}</span></div>
            <button type="button" onClick={() => setSearchOpen(true)} className="flex h-8 items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 text-xs text-zinc-500 hover:text-zinc-300"><Search size={13} /><span className="hidden sm:inline">Panelde ara...</span><span className="hidden items-center gap-0.5 rounded border border-zinc-700 px-1 font-mono text-[10px] sm:flex"><Command size={9} />K</span></button>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="flex max-w-[42vw] items-center gap-1.5 truncate rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-300">
              {role === "shop" ? <Store size={14} className="shrink-0" /> : role === "sponsor" ? <Megaphone size={14} /> : <Scissors size={14} />}
              {roleLabel}
            </span>
            <button type="button" aria-label="Temayı değiştir" onClick={() => setTheme((value) => value === "dark" ? "light" : "dark")} className="rounded-md p-2 text-zinc-400 hover:bg-zinc-900">{theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}</button>
            <UserDropdown user={user} onUserUpdated={setUser} onSignOut={() => void signOut()} showCustomerLinks={false} />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7">{children}</main>
      </div>

      {searchOpen && <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/60 p-3 pt-[12vh]" onMouseDown={(event) => { if (event.target === event.currentTarget) setSearchOpen(false); }}>
        <section role="dialog" aria-modal="true" aria-label="Panel araması" className="w-full max-w-lg overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
          <FormFieldset className="flex items-center gap-2 border-b border-zinc-800 px-4">
            <Search size={15} className="text-zinc-500" />
            <FormField label="Panelde ara" description="Panel sayfalarında ada göre arama yapın." className="flex-1">
              <FormInput autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Menüde ara..." className="h-12 border-0 bg-transparent text-sm" />
            </FormField>
            <button type="button" onClick={() => setSearchOpen(false)} aria-label="Aramayı kapat"><X size={15} className="text-zinc-500" /></button>
          </FormFieldset>
          <div className="max-h-72 overflow-y-auto p-2">{matches.map((item) => <Link key={item.href} href={item.href} onClick={() => setSearchOpen(false)} className="block rounded-md px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-900">{item.label}</Link>)}{matches.length === 0 && <p className="p-5 text-center text-xs text-zinc-500">Sonuç bulunamadı.</p>}</div>
        </section>
      </div>}
    </div>
  );
}

export function PortalShell({ children, role }: { children: React.ReactNode; role: PortalRole }) {
  const userRole = role === "admin" ? "super_admin" : role === "shop" ? "shop_owner" : "sponsor";
  return (
    <NotificationProvider role={userRole} userId={`portal-${role}`}>
      <PortalShellContent role={role}>{children}</PortalShellContent>
    </NotificationProvider>
  );
}
