import { ShopDetail } from "@/components/user/ShopDetail";

export default async function ShopDetailBySlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ShopDetail shopId={slug} bySlug />;
}
