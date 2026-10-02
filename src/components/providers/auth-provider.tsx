"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { currentUser } from "@/lib/auth";
import type { User } from "@/types/api";

type AuthStatus = "loading" | "guest" | "authenticated" | "error";

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  error: string;
  refresh: () => Promise<User | null>;
  updateUser: (user: User) => void;
  authenticate: (user: User) => void;
  requestCustomerAccess: (action: string, returnTo?: string) => boolean;
}

interface AuthDialogState {
  action: string;
  returnTo: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<AuthDialogState | null>(null);
  const requestId = useRef(0);
  const updateUser = useCallback((updated: User) => setUser(updated), []);
  const authenticate = useCallback((authenticatedUser: User) => {
    setUser(authenticatedUser);
    setStatus("authenticated");
    setError("");
    setDialog(null);
  }, []);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const current = await currentUser();
      if (id !== requestId.current) return null;
      setUser(current);
      setStatus("authenticated");
      setError("");
      setDialog(null);
      return current;
    } catch (reason) {
      if (id !== requestId.current) return null;
      setUser(null);
      if (reason instanceof ApiError && reason.status === 401) {
        setError("");
        setStatus("guest");
        return null;
      }
      setStatus("error");
      setError(reason instanceof Error ? reason.message : "Oturum doğrulanamadı.");
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    const id = ++requestId.current;
    currentUser().then((current) => {
      if (!active || id !== requestId.current) return;
      setUser(current);
      setStatus("authenticated");
      setError("");
      setDialog(null);
    }).catch((reason: unknown) => {
      if (!active || id !== requestId.current) return;
      setUser(null);
      if (reason instanceof ApiError && reason.status === 401) {
        setError("");
        setStatus("guest");
        return;
      }
      setStatus("error");
      setError(reason instanceof Error ? reason.message : "Oturum doğrulanamadı.");
    });
    const handleAuthChange = () => { void refresh(); };
    window.addEventListener("hementiras:auth-changed", handleAuthChange);
    return () => {
      active = false;
      window.removeEventListener("hementiras:auth-changed", handleAuthChange);
    };
  }, [refresh]);

  const requestCustomerAccess = useCallback((action: string, returnTo = window.location.pathname + window.location.search) => {
    if (status === "authenticated" && user?.role === "customer") return true;
    setDialog({ action, returnTo });
    return false;
  }, [status, user]);

  const value = useMemo(
    () => ({ user, status, error, refresh, updateUser, authenticate, requestCustomerAccess }),
    [user, status, error, refresh, updateUser, authenticate, requestCustomerAccess],
  );
  const next = dialog?.returnTo.startsWith("/") && !dialog.returnTo.startsWith("//")
    ? dialog.returnTo
    : "/shops";
  const loginHref = `/login?${new URLSearchParams({ next }).toString()}`;
  const registerHref = `/register?${new URLSearchParams({ next }).toString()}`;

  return (
    <AuthContext.Provider value={value}>
      {children}
      {dialog && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(null); }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="auth-required-title" className="w-full max-w-sm space-y-4 rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="auth-required-title" className="text-sm font-semibold text-zinc-100">Müşteri hesabı gerekli</h2>
                <p className="mt-2 text-xs leading-5 text-zinc-400">
                  {dialog.action} için lütfen giriş yapın veya üye olun.
                </p>
              </div>
              <button type="button" aria-label="Pencereyi kapat" onClick={() => setDialog(null)} className="text-zinc-500 hover:text-zinc-200">
                <X size={17} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Link href={loginHref} className="rounded-md bg-zinc-100 px-3 py-2.5 text-center text-xs font-medium text-zinc-950 hover:bg-white">
                Giriş yap
              </Link>
              <Link href={registerHref} className="rounded-md border border-zinc-700 px-3 py-2.5 text-center text-xs font-medium text-zinc-200 hover:bg-zinc-900">
                Üye ol
              </Link>
            </div>
          </section>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
}
