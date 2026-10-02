import { notFound } from "next/navigation";
import { RoleWorkspacePage } from "@/components/RoleWorkspacePage";
import { PAGE_DATA } from "@/data/portal";

export default async function AdminSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!PAGE_DATA.admin[section]) notFound();
  return <RoleWorkspacePage role="admin" slug={section} />;
}
