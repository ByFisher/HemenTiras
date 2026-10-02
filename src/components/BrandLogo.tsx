import Image from "next/image";

export function BrandLogo({
  size = 40,
  className = "",
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/logo.svg"
      alt="HemenTıraş"
      width={size}
      height={size}
      className={`shrink-0 object-contain ${className}`}
      priority={priority}
    />
  );
}

export function BrandLoading({ label = "Yükleniyor..." }: { label?: string }) {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#09090b] text-xs text-zinc-400"
      role="status"
      aria-live="polite"
    >
      <BrandLogo size={72} priority className="animate-pulse" />
      <span>{label}</span>
    </main>
  );
}

export { BrandLogo as Logo };
