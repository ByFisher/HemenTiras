"use client";

import { Heart } from "lucide-react";

export function FavoriteButton({
  isFavorite,
  isPending,
  onClick,
}: {
  isFavorite: boolean;
  isPending: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={isFavorite ? "Favorilerden çıkar" : "Favorilere ekle"}
      aria-pressed={isFavorite}
      disabled={isPending}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950/90 text-zinc-300 hover:text-rose-400 disabled:opacity-50"
    >
      <Heart size={16} className={isFavorite ? "fill-rose-500 text-rose-500" : ""} />
    </button>
  );
}
