"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ApiError } from "@/lib/api-client";
import { appointmentApi } from "@/lib/services";
import type { Appointment, AppointmentNotification, UserRole } from "@/types/api";

interface NotificationContextValue {
  notifications: AppointmentNotification[];
  unreadCount: number;
  upcomingCount: number;
  toast: string;
  error: string;
  refresh: () => void;
  markAllRead: () => void;
  dismissToast: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);
const READ_KEY = "hementiras:read-notifications";
const REMINDER_KEY = "hementiras:shown-reminders";

function readStoredSet(key: string): Set<string> {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set();
  }
}

function notificationItems(appointments: Appointment[], readIds: Set<string>): AppointmentNotification[] {
  const now = Date.now();
  const items: AppointmentNotification[] = [];

  for (const appointment of appointments) {
    const startsAt = appointment.startsAt;
    const shopName = appointment.shop?.name ?? "Dükkan";
    const startTime = new Date(startsAt).toLocaleString("tr-TR", {
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
    const item = (type: AppointmentNotification["type"], title: string, message: string) => {
      const id = `${appointment.id}:${type}:${appointment.status}`;
      items.push({
        id,
        appointmentId: appointment.id,
        type,
        title,
        message,
        startsAt,
        shopName,
        status: appointment.status,
        unread: !readIds.has(id),
      });
    };

    if (appointment.status === "pending") {
      item("status", "Randevu talebi alındı", `${shopName} · ${startTime}`);
    } else if (appointment.status === "confirmed") {
      item("status", "Randevu onaylandı", `${shopName} · ${startTime}`);
      const timeUntilAppointment = new Date(startsAt).getTime() - now;
      if (timeUntilAppointment >= 0 && timeUntilAppointment <= 60 * 60 * 1000) {
        item("reminder", "Randevunuz yaklaşıyor", `Bugün saat ${new Date(startsAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}'da ${shopName} berberinde randevunuz var.`);
      }
    } else if (appointment.status === "completed") {
      item("status", "Randevu tamamlandı", `${shopName} · ${startTime}`);
    } else if (appointment.status === "cancelled" || appointment.status === "cancelled_by_shop") {
      item(
        "status",
        appointment.status === "cancelled_by_shop" ? "Dükkan randevuyu iptal etti" : "Randevu iptal edildi",
        `${shopName} · ${startTime}${appointment.status === "cancelled_by_shop" ? " · Ödeme iadesi başlatıldı." : ""}`,
      );
    } else if (appointment.status === "no_show") {
      item("status", "Randevuya katılmadınız", `${shopName} · ${startTime}`);
    }
  }

  return items.sort((first, second) => second.startsAt.localeCompare(first.startsAt));
}

export function NotificationProvider({ children, role, userId }: { children: ReactNode; role: UserRole; userId: string }) {
  const [notifications, setNotifications] = useState<AppointmentNotification[]>([]);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const previousStatuses = useRef<Map<string, Appointment["status"]>>(new Map());
  const running = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const dismissToast = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast("");
  }, []);

  const markAllRead = useCallback(() => {
    const key = `${READ_KEY}:${userId}`;
    const readIds = readStoredSet(key);
    for (const notification of notifications) readIds.add(notification.id);
    window.localStorage.setItem(key, JSON.stringify([...readIds]));
    setNotifications((items) => items.map((item) => ({ ...item, unread: false })));
  }, [notifications, userId]);

  useEffect(() => {
    if (role !== "customer") return;

    let active = true;

    const load = async () => {
      if (running.current) return;
      running.current = true;
      try {
        const appointments = await appointmentApi.active();
        if (!active) return;
        const readIds = readStoredSet(`${READ_KEY}:${userId}`);
        const items = notificationItems(appointments, readIds);
        const now = Date.now();
        const upcoming = appointments.filter((appointment) =>
          ["pending", "confirmed"].includes(appointment.status)
          && new Date(appointment.startsAt).getTime() >= now,
        );
        setNotifications(items);
        setUpcomingCount(upcoming.length);
        setError("");

        const reminder = items.find((item) => item.type === "reminder" && item.status === "confirmed");
        if (reminder) {
          const shown = readStoredSet(`${REMINDER_KEY}:${userId}`);
          if (!shown.has(reminder.appointmentId)) {
            shown.add(reminder.appointmentId);
            window.localStorage.setItem(`${REMINDER_KEY}:${userId}`, JSON.stringify([...shown]));
            setToast(`Randevu Zamanı! ${reminder.message}`);
            if (toastTimer.current) clearTimeout(toastTimer.current);
            toastTimer.current = setTimeout(() => setToast(""), 8000);
          }
        }

        const nextStatuses = new Map(appointments.map((appointment) => [appointment.id, appointment.status]));
        const statusChange = appointments.find((appointment) => {
          const previous = previousStatuses.current.get(appointment.id);
          return previous === "pending" && appointment.status === "confirmed";
        });
        if (statusChange) {
          setToast(`${statusChange.shop?.name ?? "Dükkan"} randevunuzu onayladı.`);
          if (toastTimer.current) clearTimeout(toastTimer.current);
          toastTimer.current = setTimeout(() => setToast(""), 8000);
        }
        previousStatuses.current = nextStatuses;
      } catch (reason) {
        if (!active) return;
        if (reason instanceof ApiError && reason.status === 401) {
          setNotifications([]);
          setUpcomingCount(0);
          setError("");
        } else {
          setError(reason instanceof Error ? reason.message : "Bildirimler yüklenemedi.");
        }
      } finally {
        running.current = false;
      }
    };

    void load();
    const interval = window.setInterval(() => void load(), 60_000);
    window.addEventListener("hementiras:splash", refresh);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("hementiras:splash", refresh);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [refresh, revision, role, userId]);

  const unreadCount = notifications.filter((item) => item.unread).length;
  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, upcomingCount, toast, error, refresh, markAllRead, dismissToast }}
    >
      {children}
      {toast && (
        <div className="fixed right-4 top-4 z-[110] flex max-w-sm items-start gap-3 rounded-lg border border-emerald-800 bg-zinc-950 p-4 text-sm text-zinc-100 shadow-2xl" role="status">
          <span className="mt-1 h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-400" />
          <p className="flex-1 text-xs leading-5">{toast}</p>
          <button type="button" onClick={dismissToast} aria-label="Bildirimi kapat" className="text-zinc-500 hover:text-zinc-200">×</button>
        </div>
      )}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used within NotificationProvider.");
  return context;
}
