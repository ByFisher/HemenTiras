import { DemoIyzicoCheckout } from "@/components/user/DemoIyzicoCheckout";

export default async function DemoIyzicoPage({
  params,
}: {
  params: Promise<{ appointmentId: string }>;
}) {
  const { appointmentId } = await params;

  return <DemoIyzicoCheckout appointmentId={appointmentId} />;
}
