"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ErrorBoundary } from "@/components/feedback/ErrorBoundary";
import { useAuth } from "@/components/providers/auth-provider";
import { logout, userDestination } from "@/lib/auth";
import type { User } from "@/types/api";
import { BrandLoading, BrandLogo } from "@/components/BrandLogo";
import { NotificationMenu } from "@/components/header/notification-menu";
import { UserDropdown } from "@/components/header/user-dropdown";
import { NotificationProvider } from "@/components/providers/notification-provider";

const links = [
  { href: "/shops", label: "Dükkan Ara" },
];

function requiresCustomer(pathname: string) {
  return pathname === "/my-appointments"
    || pathname === "/notifications"
    || pathname === "/checkout"
    || pathname.startsWith("/demo-iyzico/")
    || pathname.startsWith("/book/");
}

function CustomerLayoutContent({
  children,
  pathname,
  user,
  onUserUpdated,
  onSignOut,
}: {
  children: ReactNode;
  pathname: string;
  user: User | null;
  onUserUpdated: (user: User) => void;
  onSignOut: () => void;
}) {
  const isCustomer = user?.role === "customer";

  return (
    <div className="min-h-full bg-[#09090b] text-zinc-100">
      <header className="border-b border-zinc-800">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <Link href="/shops" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <BrandLogo size={32} className="rounded-md" />
            HemenTıraş
          </Link>
          <div className="flex items-center gap-4 text-xs text-zinc-400">
            {links.map((link) => (
              <Link key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined} className="hover:text-zinc-100">{link.label}</Link>
            ))}
            {isCustomer && <Link href="/my-appointments" className="hover:text-zinc-100">Randevularım</Link>}
            {user && isCustomer && <NotificationMenu />}
            {user && (
              <UserDropdown
                user={user}
                onUserUpdated={onUserUpdated}
                onSignOut={onSignOut}
                showCustomerLinks={isCustomer}
              />
            )}
            {!user && (
              <>
                <Link href="/login" className="hover:text-zinc-100">Giriş yap</Link>
                <Link href="/register" className="rounded bg-zinc-100 px-3 py-2 font-medium text-zinc-950 hover:bg-white">Üye ol</Link>
              </>
            )}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
    </div>
  );
}

function CustomerAccessRequired({ onRequestAccess }: { onRequestAccess: () => void }) {
  return (
    <section className="mx-auto max-w-md space-y-3 rounded-xl border border-zinc-800 bg-zinc-950 p-6 text-center">
      <h1 className="text-sm font-semibold text-zinc-100">Müşteri hesabı gerekli</h1>
      <p className="text-xs leading-5 text-zinc-400">Randevu almak veya randevularınızı görüntülemek için müşteri hesabınızla giriş yapın.</p>
      <button type="button" onClick={onRequestAccess} className="rounded-md bg-zinc-100 px-4 py-2 text-xs font-medium text-zinc-950 hover:bg-white">
        Giriş yap veya üye ol
      </button>
      <Link href="/shops" className="block text-xs text-zinc-400 hover:text-zinc-100">Dükkan aramaya dön</Link>
    </section>
  );
}

export default function UserLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, status, updateUser, requestCustomerAccess } = useAuth();
  const [signOutError, setSignOutError] = useState("");
  const protectedRoute = requiresCustomer(pathname);

  useEffect(() => {
    if (protectedRoute && status === "authenticated" && user && user.role !== "customer") {
      router.replace(userDestination(user));
      return;
    }
    if (protectedRoute && status !== "loading" && !(status === "authenticated" && user?.role === "customer")) {
      requestCustomerAccess(pathname.startsWith("/book/") || pathname === "/checkout" ? "randevu almak" : "randevularınızı görüntülemek", pathname);
    }
  }, [pathname, protectedRoute, requestCustomerAccess, router, status, user]);

  const signOut = async () => {
    setSignOutError("");
    try {
      await logout();
      router.replace("/shops");
    } catch (reason) {
      setSignOutError(reason instanceof Error ? reason.message : "Oturum kapatılamadı.");
    }
  };

  const content = (
    <>
      {signOutError && <p role="alert" className="border-b border-rose-900 bg-rose-950/30 px-4 py-2 text-center text-xs text-rose-300">{signOutError}</p>}
      <CustomerLayoutContent
        pathname={pathname}
        user={user}
        onUserUpdated={updateUser}
        onSignOut={() => void signOut()}
      >
        {protectedRoute && !(status === "authenticated" && user?.role === "customer")
          ? status === "loading"
            ? <BrandLoading label="Oturum doğrulanıyor..." />
            : <CustomerAccessRequired onRequestAccess={() => requestCustomerAccess(
              pathname.startsWith("/book/") || pathname === "/checkout" ? "randevu almak" : "randevularınızı görüntülemek",
              pathname,
            )} />
          : children}
      </CustomerLayoutContent>
    </>
  );

  return user
    ? <NotificationProvider role={user.role} userId={user.id}>{content}</NotificationProvider>
    : content;
}
