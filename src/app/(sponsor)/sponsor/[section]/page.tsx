import { notFound } from "next/navigation";
import { RoleWorkspacePage } from "@/components/RoleWorkspacePage";
import { PAGE_DATA } from "@/data/portal";

export default async function SponsorSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!PAGE_DATA.sponsor[section]) notFound();
  return <RoleWorkspacePage role="sponsor" slug={section} />;
}
