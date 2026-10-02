"use client";

import Link from "next/link";
import { Bell, CalendarClock, CircleCheck, Clock3 } from "lucide-react";
import { useNotifications } from "@/components/providers/notification-provider";

export function NotificationsPage() {
  const { notifications, unreadCount, error, refresh, markAllRead } = useNotifications();

  return (
    <section className="mx-auto max-w-3xl space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Bildirimler</h1>
          <p className="mt-1 text-xs text-zinc-500">Randevularınızın güncel durumunu ve yaklaşan saatleri takip edin.</p>
        </div>
        {unreadCount > 0 && <button type="button" onClick={markAllRead} className="rounded-md border border-zinc-800 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-900">Tümünü okundu işaretle</button>}
      </header>
      {error && (
        <div role="alert" className="rounded-lg border border-rose-900 bg-rose-950/20 p-4 text-xs text-rose-300">
          <p>{error}</p>
          <button type="button" onClick={refresh} className="mt-2 underline">Tekrar dene</button>
        </div>
      )}
      {notifications.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-10 text-center">
          <Bell size={22} className="mx-auto text-zinc-600" />
          <p className="mt-3 text-sm text-zinc-300">Henüz bildiriminiz yok.</p>
          <Link href="/shops" className="mt-4 inline-block text-xs text-zinc-400 underline">Dükkanları keşfet</Link>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-950">
          {notifications.map((item) => {
            const Icon = item.type === "reminder" ? CalendarClock : item.status === "confirmed" || item.status === "completed" ? CircleCheck : Clock3;
            return (
              <li key={item.id} className="flex items-start gap-3 p-4">
                <span className={`mt-0.5 rounded-lg border p-2 ${item.type === "reminder" ? "border-emerald-900 bg-emerald-950/40 text-emerald-300" : "border-zinc-800 bg-zinc-900 text-zinc-400"}`}><Icon size={16} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs font-medium text-zinc-100">{item.title}</h2>
                    {item.unread && <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-zinc-400">{item.message}</p>
                  <time className="mt-2 block text-[10px] text-zinc-600">{new Date(item.startsAt).toLocaleString("tr-TR")}</time>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
