import { Suspense } from "react";
import { MyAppointments } from "@/components/user/MyAppointments";
import { SkeletonRows } from "@/components/feedback/Skeleton";

export default function MyAppointmentsPage() {
  return (
    <Suspense fallback={<SkeletonRows rows={3} columns={3} />}>
      <MyAppointments />
    </Suspense>
  );
}
