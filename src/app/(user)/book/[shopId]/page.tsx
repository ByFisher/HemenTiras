import { Suspense } from "react";
import { BookingFlow } from "@/components/user/BookingFlow";
import { SkeletonRows } from "@/components/feedback/Skeleton";

export default async function BookPage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  return (
    <Suspense fallback={<SkeletonRows rows={4} columns={3} />}>
      <BookingFlow shopId={shopId} />
    </Suspense>
  );
}
