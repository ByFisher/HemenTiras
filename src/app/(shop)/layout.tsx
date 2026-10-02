import type { ReactNode } from "react";
import { PortalShell } from "@/components/PortalShell";

export default function ShopLayout({ children }: { children: ReactNode }) {
  return <PortalShell role="shop">{children}</PortalShell>;
}
