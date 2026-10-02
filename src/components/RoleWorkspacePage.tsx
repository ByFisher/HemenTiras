"use client";

import { AdminApprovalQueue } from "@/components/admin/AdminApprovalQueue";
import { AdminDirectory } from "@/components/admin/AdminDirectory";
import { AdminSliderManager } from "@/components/admin/AdminSliderManager";
import { AdminStaffManager } from "@/components/admin/AdminStaffManager";
import { AccessLogsPanel } from "@/components/admin/AccessLogsPanel";
import { CouponManager } from "@/components/admin/CouponManager";
import { FinancialLogsPanel } from "@/components/admin/FinancialLogsPanel";
import { AdminReviewQueue, AdminSupportQueue } from "@/components/admin/AdminModerationQueues";
import { ShopAppointmentsPanel } from "@/components/ShopAppointmentsPanel";
import { ShopLiveModulesPanel } from "@/components/ShopLiveModulesPanel";
import { ErrorBoundary } from "@/components/feedback/ErrorBoundary";
import { ShopCustomersPanel } from "@/components/ShopCustomersPanel";
import { ShopProfilePanel } from "@/components/ShopProfilePanel";
import { ShopServicesPanel } from "@/components/ShopServicesPanel";
import { ShopStaffPanel } from "@/components/ShopStaffPanel";
import { SponsorApprovalQueue } from "@/components/SponsorApprovalQueue";
import { SponsorSupportForm } from "@/components/SponsorSupportForm";
import { PAGE_DATA } from "@/data/portal";
import type { PortalRole } from "@/types/portal";

export function RoleWorkspacePage({ role, slug }: { role: PortalRole; slug: string }) {
  const page = PAGE_DATA[role][slug];

  if (!page) {
    return <p role="alert" className="rounded-md border border-rose-900 bg-rose-950/30 p-4 text-sm text-rose-300">
      İstenen panel bölümü bulunamadı.
    </p>;
  }

  let livePanel: React.ReactNode = null;
  if (role === "admin" && slug === "users") livePanel = <AdminDirectory view="customers" />;
  if (role === "admin" && slug === "sliders") livePanel = <AdminSliderManager />;
  if (role === "admin" && slug === "shops") livePanel = <AdminDirectory view="shops" />;
  if (role === "admin" && slug === "pending-shops") livePanel = <AdminDirectory view="shops" initialStatus="pending_approval" />;
  if (role === "admin" && slug === "sponsors") livePanel = <AdminDirectory view="sponsors" />;
  if (role === "admin" && slug === "shop-approvals") livePanel = <AdminApprovalQueue />;
  if (role === "admin" && slug === "sponsor-approvals") livePanel = <SponsorApprovalQueue />;
  if (role === "admin" && slug === "administrators") livePanel = <AdminStaffManager />;
  if (role === "admin" && slug === "coupons") livePanel = <CouponManager admin />;
  if (role === "admin" && slug === "financial-logs") livePanel = <FinancialLogsPanel />;
  if (role === "admin" && slug === "legal-logs") livePanel = <AccessLogsPanel />;
  if (role === "admin" && slug === "review-moderation") livePanel = <AdminReviewQueue />;
  if (role === "admin" && slug === "support-requests") livePanel = <AdminSupportQueue />;
  if (role === "shop" && slug === "customers") livePanel = <ShopCustomersPanel />;
  if (role === "shop" && slug === "calendar") livePanel = <ShopAppointmentsPanel />;
  if (role === "shop" && slug === "payouts") livePanel = <FinancialLogsPanel shop />;
  if (role === "shop" && slug === "coupons") livePanel = <CouponManager />;
  if (role === "shop" && slug === "services") livePanel = <ShopServicesPanel />;
  if (role === "shop" && slug === "staff") livePanel = <ShopStaffPanel />;
  if (role === "shop" && slug === "profile") livePanel = <ShopProfilePanel />;
  if (role === "shop" && (slug === "gallery" || slug === "reviews" || slug === "hours")) {
    livePanel = <ShopLiveModulesPanel section={slug} />;
  }
  if (role === "sponsor" && slug === "support") livePanel = <SponsorSupportForm />;

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-5">
      <div className="border-b border-zinc-800 pb-5">
        <h1 className="text-lg font-semibold tracking-tight text-zinc-100">{page.title}</h1>
        {livePanel && <p className="mt-1 text-xs leading-relaxed text-zinc-500">Kayıtlar Laravel API üzerinden yüklenir.</p>}
      </div>
      {livePanel ? (
        <ErrorBoundary>{livePanel}</ErrorBoundary>
      ) : (
        <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-sm font-medium text-zinc-200">Bu bölüm henüz canlı sisteme bağlanmadı</h2>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-zinc-500">
            Sahte kayıtlar ve işlemler kapalıdır. Bu bölüm için canlı backend bağlantısı kurulana kadar gerçek olmayan bilgi gösterilmeyecektir.
          </p>
        </section>
      )}
    </div>
  );
}
