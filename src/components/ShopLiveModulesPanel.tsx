"use client";

import Image from "next/image";
import { Disclosure, DisclosureButton, DisclosurePanel } from "@headlessui/react";
import { ChevronDown, ImagePlus, Star } from "lucide-react";
import { useRef, useState } from "react";
import { EmptyState, ErrorAlert, SkeletonBlock } from "@/components/feedback/Skeleton";
import {
  updateShopHours,
  uploadShopContentImage,
} from "@/lib/shop-management-api";
import { useApiMutation, useApiQuery } from "@/lib/use-api";
import type {
  ShopGalleryImage,
  ShopHoursData,
  ShopReview,
  ShopReviewsData,
  WeeklyWorkDay,
} from "@/types/portal";

type ShopLiveSection = "gallery" | "reviews" | "hours";

const DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

function defaultSchedule(): WeeklyWorkDay[] {
  return DAYS.map((day) => ({
    day,
    enabled: false,
    start: "",
    end: "",
    breakStart: "",
    breakEnd: "",
  }));
}

function completeSchedule(schedule: WeeklyWorkDay[] = []): WeeklyWorkDay[] {
  const stored = new Map(schedule.map((day) => [day.day, day]));
  return defaultSchedule().map((day) => {
    const savedDay = stored.get(day.day);
    return savedDay ? {
      ...day,
      ...savedDay,
      start: savedDay.start ?? "",
      end: savedDay.end ?? "",
      breakStart: savedDay.breakStart ?? "",
      breakEnd: savedDay.breakEnd ?? "",
    } : day;
  });
}

function approvalLabel(status: ShopGalleryImage["approvalStatus"]) {
  if (status === "approved") return "Yayında";
  if (status === "rejected") return "Reddedildi";
  return "Onay bekliyor";
}

function ShopGalleryPanel() {
  const gallery = useApiQuery<ShopGalleryImage[]>(["/shop/gallery"], { list: true });
  const inputRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState("");
  const upload = useApiMutation<{ file: File }, ShopGalleryImage>(
    ({ file }) => uploadShopContentImage(file, "gallery_image", file.name),
  );

  const uploadSelectedFile = async (file: File | undefined) => {
    if (!file) return;
    setNotice("");
    const submission = await upload.run({ file });
    if (submission) {
      gallery.refresh();
      setNotice("Fotoğraf onay kuyruğuna gönderildi.");
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500">Dükkan fotoğrafları canlı API’den yüklenir; yeni fotoğraflar yayınlanmadan önce onaylanır.</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            void uploadSelectedFile(file);
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={upload.isPending}
          className="inline-flex items-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900 disabled:opacity-50"
        >
          <ImagePlus size={14} />
          {upload.isPending ? "Yükleniyor..." : "Fotoğraf ekle"}
        </button>
      </div>
      <ErrorAlert message={gallery.error} onRetry={gallery.refresh} />
      <ErrorAlert message={upload.error} />
      {notice && <p role="status" className="rounded-md border border-emerald-900 bg-emerald-950/30 p-3 text-xs text-emerald-300">{notice}</p>}
      {gallery.isLoading ? (
        <SkeletonBlock className="h-40" />
      ) : (gallery.data ?? []).length === 0 ? (
        <EmptyState message="Henüz galeri fotoğrafı bulunmuyor." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(gallery.data ?? []).map((image) => (
            <li key={image.id} className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
              <div className="relative aspect-[4/3] bg-zinc-900">
                {image.previewUrl ? (
                  <Image
                    src={image.previewUrl}
                    alt={image.title}
                    fill
                    unoptimized
                    crossOrigin="use-credentials"
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-zinc-600"><ImagePlus size={24} /></div>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 p-3">
                <p className="truncate text-xs text-zinc-200">{image.title}</p>
                <span className={`shrink-0 rounded px-2 py-1 text-[10px] ${image.isApproved ? "bg-emerald-950 text-emerald-300" : image.approvalStatus === "rejected" ? "bg-rose-950 text-rose-300" : "bg-amber-950 text-amber-300"}`}>
                  {approvalLabel(image.approvalStatus)}
                </span>
              </div>
              {image.rejectionReason && <p className="px-3 pb-3 text-[11px] text-rose-300">{image.rejectionReason}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ShopReviewsPanel() {
  const response = useApiQuery<ShopReviewsData>(["/shop/reviews"]);
  const reviews = response.data?.reviews ?? [];

  return (
    <section className="space-y-4">
      {response.data && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <div className="flex items-center gap-1 text-amber-300" aria-label={`${response.data.averageRating.toFixed(1)} / 5`}>
            <Star size={16} fill="currentColor" />
            <span className="text-sm font-semibold">{response.data.averageRating.toFixed(1)}</span>
          </div>
          <p className="text-xs text-zinc-500">{response.data.reviewCount} müşteri değerlendirmesi</p>
        </div>
      )}
      <ErrorAlert message={response.error} onRetry={response.refresh} />
      {response.isLoading ? (
        <SkeletonBlock className="h-40" />
      ) : reviews.length === 0 ? (
        <EmptyState message="Dükkanınız için henüz müşteri değerlendirmesi yok." />
      ) : (
        <ul className="space-y-3">
          {reviews.map((review) => <ReviewCard key={review.id} review={review} />)}
        </ul>
      )}
    </section>
  );
}

function ReviewCard({ review }: { review: ShopReview }) {
  return (
    <li className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-zinc-200">{review.customerFirstName} · {review.staffName}</p>
          <p className="mt-1 text-[11px] text-zinc-500">{new Date(review.createdAt).toLocaleDateString("tr-TR")}</p>
        </div>
        <div className="flex items-center gap-1" aria-label={`${review.rating} / 5`}>
          {Array.from({ length: 5 }, (_, index) => (
            <Star key={index} size={13} className={index < review.rating ? "text-amber-300" : "text-zinc-700"} fill={index < review.rating ? "currentColor" : "none"} />
          ))}
        </div>
      </div>
      {review.comment && <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-zinc-400">{review.comment}</p>}
    </li>
  );
}

function ShopHoursPanel() {
  const hours = useApiQuery<ShopHoursData>(["/shop/hours"]);
  const [scheduleDraft, setScheduleDraft] = useState<WeeklyWorkDay[] | null>(null);
  const workingHours = scheduleDraft ?? completeSchedule(hours.data?.workingHours);
  const [notice, setNotice] = useState("");
  const save = useApiMutation<WeeklyWorkDay[], ShopHoursData>(updateShopHours);

  const updateDay = (dayName: string, changes: Partial<WeeklyWorkDay>) => {
    setNotice("");
    save.reset();
    setScheduleDraft(workingHours.map((day) => day.day === dayName ? { ...day, ...changes } : day));
  };

  const saveSchedule = async () => {
    const result = await save.run(workingHours);
    if (result) {
      setScheduleDraft(completeSchedule(result.workingHours));
      setNotice("Dükkan çalışma saatleri kaydedildi.");
      hours.refresh();
    }
  };

  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-zinc-200">Dükkan çalışma saatleri</h2>
            <p className="mt-1 text-[11px] text-zinc-500">Açık günleri, çalışma aralığını ve mola saatlerini belirleyin.</p>
          </div>
          <button type="button" onClick={() => void saveSchedule()} disabled={hours.isLoading || save.isPending} className="rounded-md bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-950 hover:bg-white disabled:opacity-50">
            {save.isPending ? "Kaydediliyor..." : "Saatleri kaydet"}
          </button>
        </div>
        <ErrorAlert message={hours.error} onRetry={hours.refresh} />
        <ErrorAlert message={save.error} />
        {notice && <p role="status" className="mt-3 rounded-md border border-emerald-900 bg-emerald-950/30 p-3 text-xs text-emerald-300">{notice}</p>}
        {hours.isLoading ? (
          <SkeletonBlock className="mt-4 h-40" />
        ) : (
          <div className="mt-4 divide-y divide-zinc-800">
            {workingHours.map((day) => (
              <div key={day.day} className="grid gap-3 py-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
                <label className="flex items-center gap-2 text-xs text-zinc-300">
                  <input type="checkbox" checked={day.enabled} onChange={(event) => updateDay(day.day, { enabled: event.target.checked })} className="accent-zinc-100" />
                  {day.day}
                </label>
                <label className="flex items-center gap-2 text-[11px] text-zinc-500">
                  Açılış
                  <input aria-label={`${day.day} açılış`} type="time" value={day.start} disabled={!day.enabled} onChange={(event) => updateDay(day.day, { start: event.target.value })} className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 disabled:opacity-40" />
                </label>
                <label className="flex items-center gap-2 text-[11px] text-zinc-500">
                  Kapanış
                  <input aria-label={`${day.day} kapanış`} type="time" value={day.end} disabled={!day.enabled} onChange={(event) => updateDay(day.day, { end: event.target.value })} className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 disabled:opacity-40" />
                </label>
                <div className="flex items-center gap-2">
                  <input aria-label={`${day.day} mola başlangıcı`} type="time" value={day.breakStart} disabled={!day.enabled} onChange={(event) => updateDay(day.day, { breakStart: event.target.value })} className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 disabled:opacity-40" />
                  <span className="text-[10px] text-zinc-600">Mola</span>
                  <input aria-label={`${day.day} mola bitişi`} type="time" value={day.breakEnd} disabled={!day.enabled} onChange={(event) => updateDay(day.day, { breakEnd: event.target.value })} className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 disabled:opacity-40" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-200">Personel vardiyaları</h2>
        {hours.data?.shifts.length ? hours.data.shifts.map((shift) => (
          <Disclosure key={shift.id} as="div" className="rounded-lg border border-zinc-800 bg-zinc-950">
            <DisclosureButton className="group flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-xs text-zinc-200">
              <span>{shift.name}<span className="ml-2 text-[10px] text-zinc-500">{shift.approvalStatus === "approved" ? "Onaylı" : "Onay bekliyor"}</span></span>
              <ChevronDown size={14} className="text-zinc-500 transition group-data-open:rotate-180" />
            </DisclosureButton>
            <DisclosurePanel className="border-t border-zinc-800 px-4 py-3">
              {shift.workingHours.length ? (
                <ul className="grid gap-2 text-[11px] text-zinc-400 sm:grid-cols-2 lg:grid-cols-3">
                  {shift.workingHours.map((day) => (
                    <li key={day.day}>{day.day}: {day.enabled ? `${day.start}–${day.end}${day.breakStart && day.breakEnd ? ` · mola ${day.breakStart}–${day.breakEnd}` : ""}` : "Kapalı"}</li>
                  ))}
                </ul>
              ) : <p className="text-[11px] text-zinc-500">Bu personel için vardiya tanımlanmamış.</p>}
            </DisclosurePanel>
          </Disclosure>
        )) : !hours.isLoading && <EmptyState message="Personel vardiyası bulunmuyor." />}
      </div>
    </section>
  );
}

export function ShopLiveModulesPanel({ section }: { section: ShopLiveSection }) {
  if (section === "gallery") return <ShopGalleryPanel />;
  if (section === "reviews") return <ShopReviewsPanel />;
  return <ShopHoursPanel />;
}
