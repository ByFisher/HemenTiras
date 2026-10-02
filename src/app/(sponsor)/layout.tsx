import type { ReactNode } from "react";
import { PortalShell } from "@/components/PortalShell";

export default function SponsorLayout({ children }: { children: ReactNode }) {
  return <PortalShell role="sponsor">{children}</PortalShell>;
}
