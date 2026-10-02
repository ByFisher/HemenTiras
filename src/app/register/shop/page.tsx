"use client";

import { useRouter } from "next/navigation";
import { ShopOwnerApplicationDialog } from "@/components/ShopOwnerApplicationDialog";

export default function ShopRegistrationPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[#09090b]">
      <ShopOwnerApplicationDialog
        onClose={() => router.push("/")}
        onSuccess={() => router.push("/approval-pending")}
      />
    </main>
  );
}
