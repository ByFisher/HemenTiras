import { ShopDetail } from "@/components/user/ShopDetail";

export default async function ShopDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ShopDetail shopId={id} />;
}
