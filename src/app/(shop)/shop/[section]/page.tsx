import { notFound } from "next/navigation";
import { RoleWorkspacePage } from "@/components/RoleWorkspacePage";
import { PAGE_DATA } from "@/data/portal";

export default async function ShopSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!PAGE_DATA.shop[section]) notFound();
  return <RoleWorkspacePage role="shop" slug={section} />;
}
