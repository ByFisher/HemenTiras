"use client";

import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { useNotifications } from "@/components/providers/notification-provider";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";

export function NotificationMenu() {
  const { notifications, unreadCount, upcomingCount, error, markAllRead, refresh } = useNotifications();

  return (
    <Menu>
      <MenuButton
        aria-label={`Bildirimler${unreadCount ? `, ${unreadCount} okunmamış` : ""}`}
        onClick={markAllRead}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-zinc-400 hover:border-zinc-800 hover:bg-zinc-900 hover:text-white"
      >
        <Bell size={17} />
        {unreadCount > 0 && <span className="absolute right-1 top-1 h-2 w-2 animate-pulse rounded-full bg-rose-400 ring-2 ring-zinc-950" />}
      </MenuButton>
          <MenuItems anchor="bottom end" className="z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl [--anchor-gap:8px] focus:outline-none">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <div>
                <p className="text-xs font-semibold text-zinc-100">Bildirimler</p>
                <p className="mt-0.5 text-[10px] text-zinc-500">{upcomingCount} yaklaşan randevu · {unreadCount} okunmamış</p>
              </div>
              <MenuItem>
                <button type="button" onClick={markAllRead} aria-label="Tümünü okundu işaretle" className="rounded p-1.5 text-zinc-500 data-[focus]:bg-zinc-900 data-[focus]:text-zinc-200"><CheckCheck size={15} /></button>
              </MenuItem>
            </div>
            {error ? (
              <div className="p-4">
                <p role="alert" className="text-xs text-rose-300">{error}</p>
                <MenuItem>
                  <button type="button" onClick={refresh} className="mt-2 text-xs text-zinc-300 underline">Tekrar dene</button>
                </MenuItem>
              </div>
            ) : notifications.length ? (
              <ul className="max-h-80 divide-y divide-zinc-900 overflow-y-auto">
                {notifications.slice(0, 8).map((item) => (
                  <li key={item.id}>
                    <MenuItem>
                    <Link href="/notifications" className="flex gap-3 px-4 py-3 data-[focus]:bg-zinc-900/70">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.type === "reminder" ? "animate-pulse bg-emerald-400" : item.unread ? "bg-sky-400" : "bg-zinc-700"}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-medium text-zinc-200">{item.title}</span>
                        <span className="mt-1 block text-[11px] leading-4 text-zinc-500">{item.message}</span>
                        <time className="mt-1 block text-[10px] text-zinc-600">{new Date(item.startsAt).toLocaleString("tr-TR")}</time>
                      </span>
                    </Link>
                    </MenuItem>
                  </li>
                ))}
              </ul>
            ) : <p className="px-4 py-8 text-center text-xs text-zinc-500">Yeni bildirim yok.</p>}
            <MenuItem>
              <Link href="/notifications" className="block border-t border-zinc-800 px-4 py-3 text-center text-xs font-medium text-zinc-300 data-[focus]:bg-zinc-900">Tüm bildirimleri gör</Link>
            </MenuItem>
          </MenuItems>
    </Menu>
  );
}
