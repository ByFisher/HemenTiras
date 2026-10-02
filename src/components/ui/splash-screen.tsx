"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

export function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleTimers = useCallback(() => {
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    if (hideTimer.current) clearTimeout(hideTimer.current);

    fadeTimer.current = setTimeout(() => setFading(true), 1700);
    hideTimer.current = setTimeout(() => setVisible(false), 2000);
  }, []);

  const restart = useCallback(() => {
    setVisible(true);
    setFading(false);
    setAnimationKey((key) => key + 1);
    scheduleTimers();
  }, [scheduleTimers]);

  useEffect(() => {
    scheduleTimers();
    window.addEventListener("hementiras:splash", restart);

    return () => {
      window.removeEventListener("hementiras:splash", restart);
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [restart, scheduleTimers]);

  if (!visible) return null;

  return (
    <div
      key={animationKey}
      role={fading ? undefined : "status"}
      aria-label={fading ? undefined : "HemenTıraş yükleniyor"}
      aria-hidden={fading}
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-[#09090b] transition-opacity duration-300 ${
        fading ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex w-64 flex-col items-center">
        <div className="relative mb-7 flex h-32 w-32 items-center justify-center">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="absolute h-28 w-28 rounded-full border border-white/20 bg-white/5 animate-ripple" />
            <span className="absolute h-28 w-28 rounded-full border border-white/10 bg-white/5 animate-ripple [animation-delay:400ms]" />
            <span className="absolute h-28 w-28 rounded-full border border-zinc-700/50 animate-ripple [animation-delay:800ms]" />
          </div>
          <div className="absolute inset-0 m-auto h-28 w-28 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
          <div className="relative z-10 flex h-28 w-28 items-center justify-center rounded-3xl border border-zinc-800 bg-zinc-900/90 backdrop-blur-md">
            <Image
              src="/logo.svg"
              alt="HemenTıraş"
              width={80}
              height={80}
              priority
              className="h-20 w-20 object-contain"
            />
          </div>
        </div>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-400">
          Hemen<span className="text-white">Tıraş</span>
        </h1>
      </div>
    </div>
  );
}
