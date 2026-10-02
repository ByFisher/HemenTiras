import Link from "next/link";
import { CheckoutFlow } from "@/components/user/CheckoutFlow";

type CheckoutSearchParams = Record<string, string | string[] | undefined>;

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<CheckoutSearchParams>;
}) {
  const params = await searchParams;
  const shopId = typeof params.shopId === "string" ? params.shopId : "";
  const staffId = typeof params.staffId === "string" ? params.staffId : undefined;
  const startsAt = typeof params.startsAt === "string" ? params.startsAt : undefined;
  const serviceIds = typeof params.serviceIds === "string"
    ? [...new Set(params.serviceIds.split(",").filter((id) => /^\d+$/.test(id)))].slice(0, 10)
    : [];

  if (!shopId || !serviceIds.length || (startsAt && Number.isNaN(Date.parse(startsAt)))) {
    return (
      <section className="mx-auto max-w-xl space-y-4 rounded-xl border border-zinc-800 bg-zinc-950 p-6">
        <h1 className="text-base font-semibold text-zinc-100">Ödeme özeti açılamadı</h1>
        <p className="text-sm leading-6 text-zinc-400">Dükkan veya hizmet bilgisi geçersiz. Lütfen dükkan sayfasından hizmetlerinizi yeniden seçin.</p>
        <Link href="/shops" className="inline-flex rounded-md bg-lime-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-lime-300">
          Dükkan ara
        </Link>
      </section>
    );
  }

  return (
    <CheckoutFlow
      shopId={shopId}
      staffId={staffId}
      serviceIds={serviceIds}
      startsAt={startsAt}
    />
  );
}
