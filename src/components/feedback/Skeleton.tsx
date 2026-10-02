import { BrandLogo } from "@/components/BrandLogo";

/** Liste/tablo yüklenirken gösterilen iskelet satırları. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-zinc-800/80 ${className}`} />;
}

export function SkeletonRows({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950" role="status" aria-label="Yükleniyor" aria-busy="true">
      <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/60 px-3 py-2 text-[11px] text-zinc-500">
        <BrandLogo size={22} className="animate-pulse rounded" />
        Yükleniyor…
      </div>
      <div className="divide-y divide-zinc-800/70">
        {Array.from({ length: rows }, (_, rowIndex) => (
          <div key={rowIndex} className="grid gap-3 px-3 py-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {Array.from({ length: columns }, (_, columnIndex) => (
              <Skeleton key={columnIndex} className={`h-3 ${columnIndex === 0 ? "w-2/3" : "w-full"}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonCards({ count = 6 }: { count?: number }) {
  return (
    <div role="status" aria-label="Yükleniyor" aria-busy="true">
      <div className="mb-3 flex items-center gap-2 text-[11px] text-zinc-500">
        <BrandLogo size={22} className="animate-pulse rounded" />
        Dükkanlar yükleniyor…
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
            <Skeleton className="aspect-2/1 w-full" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Tek bir bölümün yüklenme durumu. */
export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <Skeleton className={`min-h-32 w-full ${className}`} />;
}

export function ErrorAlert({ message, onRetry }: { message: string; onRetry?: () => void }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-rose-900 bg-rose-950/30 p-3 text-xs text-rose-300">
      <span>{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="rounded border border-rose-800 px-2.5 py-1.5 text-[11px] text-rose-200 hover:bg-rose-950/60">
          Tekrar dene
        </button>
      )}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-zinc-800 bg-zinc-950 p-10 text-center text-xs text-zinc-500">{message}</p>
  );
}
