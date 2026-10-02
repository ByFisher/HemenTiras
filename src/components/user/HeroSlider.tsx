"use client";

import Link from "next/link";
import { useApiQuery } from "@/lib/use-api";
import type { SliderSlide } from "@/types/api";
import { ArrowRight } from "lucide-react";
import { Autoplay, Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

function slideLink(slide: SliderSlide) {
  if (!slide.linkUrl) return null;
  if (slide.linkUrl.startsWith("/") && !slide.linkUrl.startsWith("//")) {
    return <Link href={slide.linkUrl} className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-xs font-semibold text-zinc-950 transition hover:bg-zinc-200">{slide.linkLabel || "Keşfet"} <ArrowRight size={14} /></Link>;
  }
  return <a href={slide.linkUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-xs font-semibold text-zinc-950 transition hover:bg-zinc-200">{slide.linkLabel || "Keşfet"} <ArrowRight size={14} /></a>;
}

function SlideContent({ slide }: { slide: SliderSlide }) {
  return (
    <article className="relative isolate flex min-h-64 items-end overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 sm:min-h-80 lg:min-h-[25rem]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={slide.imageUrl} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-black/85 via-black/45 to-black/10" />
      <div className="max-w-2xl space-y-4 p-6 sm:p-10 lg:p-14">
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">{slide.title}</h1>
        {slide.description && <p className="max-w-xl text-sm leading-relaxed text-zinc-200 sm:text-base">{slide.description}</p>}
        {slideLink(slide)}
      </div>
    </article>
  );
}

export function HeroSlider() {
  const { data: slides = [], error, isLoading } = useApiQuery<SliderSlide[]>(["/sliders"], { list: true });

  if (isLoading) {
    return <div aria-label="Banner yükleniyor" className="mx-auto mb-10 h-64 max-w-7xl animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/60 px-5 sm:h-80 sm:px-8 lg:px-12" />;
  }

  if (error) {
    return <p role="alert" className="mx-auto mb-10 max-w-7xl px-5 text-xs text-zinc-500 sm:px-8 lg:px-12">Bannerlar yüklenemedi: {error}</p>;
  }
  if (slides.length === 0) return null;

  if (slides.length === 1) {
    return <section aria-label="Öne çıkan banner" className="mx-auto mb-10 w-full max-w-7xl px-5 sm:px-8 lg:px-12"><SlideContent slide={slides[0]} /></section>;
  }

  return (
    <section aria-label="Öne çıkan bannerlar" className="hero-slider mx-auto mb-10 w-full max-w-7xl px-5 sm:px-8 lg:px-12">
      <Swiper
        modules={[Autoplay, Navigation, Pagination]}
        autoplay={{ delay: 4500, disableOnInteraction: false, pauseOnMouseEnter: true }}
        loop
        grabCursor
        navigation
        pagination={{ clickable: true }}
        className="overflow-hidden rounded-2xl"
      >
        {slides.map((slide) => <SwiperSlide key={slide.id}><SlideContent slide={slide} /></SwiperSlide>)}
      </Swiper>
    </section>
  );
}
