import {
  Armchair,
  BadgePercent,
  Banknote,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardList,
  Clock3,
  CreditCard,
  FilePlus2,
  Fingerprint,
  GalleryVerticalEnd,
  LayoutDashboard,
  MapPin,
  Megaphone,
  Images,
  Receipt,
  Scissors,
  ShieldAlert,
  SlidersHorizontal,
  Star,
  Store,
  Users,
  Wallet,
} from "lucide-react";
import type { PortalNavGroup, PortalPageData, PortalRole } from "@/types/portal";

export const PORTAL_HOME: Record<PortalRole, string> = {
  admin: "/admin/dashboard",
  shop: "/shop/dashboard",
  sponsor: "/sponsor/support",
};

export const PORTAL_ROLE_LABEL: Record<PortalRole, string> = {
  admin: "Süper Admin",
  shop: "Dükkan Sahibi",
  sponsor: "Sponsor",
};

export const NAVIGATION: Record<PortalRole, PortalNavGroup[]> = {
  admin: [
    { label: "Platform Yönetimi", links: [
      { label: "Genel Bakış", href: "/admin/dashboard", icon: LayoutDashboard },
      { label: "Ana Sayfa Bannerları", href: "/admin/sliders", icon: Images, allowedRoles: ["super_admin", "admin"] },
      { label: "Dükkan Yönetimi", href: "/admin/shops", icon: Store, allowedRoles: ["super_admin", "admin"] },
      { label: "Bekleyen Dükkan Onayları", href: "/admin/pending-shops", icon: ShieldAlert, allowedRoles: ["super_admin", "admin"] },
      { label: "Fotoğraf & Personel Onayları", href: "/admin/shop-approvals", icon: ShieldAlert, allowedRoles: ["super_admin", "admin", "moderator"] },
      { label: "Yorum Moderasyonu", href: "/admin/review-moderation", icon: Star, allowedRoles: ["super_admin", "admin", "moderator"] },
      { label: "Kullanıcılar & Berberler", href: "/admin/users", icon: Users, allowedRoles: ["super_admin", "admin"] },
      { label: "Yönetici ve Moderatörler", href: "/admin/administrators", icon: FilePlus2, allowedRoles: ["super_admin"] },
      { label: "Kupon Yönetimi", href: "/admin/coupons", icon: BadgePercent, allowedRoles: ["super_admin"] },
      { label: "Sponsor Onay Kuyruğu", href: "/admin/sponsor-approvals", icon: Megaphone, allowedRoles: ["super_admin", "admin"] },
      { label: "Destek Talepleri", href: "/admin/support-requests", icon: ShieldAlert, allowedRoles: ["super_admin", "admin", "moderator"] },
    ] },
    { label: "Finans & Büyüme", links: [
      { label: "Finansal Hakedişler", href: "/admin/payouts", icon: BadgePercent, allowedRoles: ["super_admin"] },
      { label: "IBAN Transfer Durumları", href: "/admin/transfers", icon: CreditCard, allowedRoles: ["super_admin"] },
      { label: "Sponsor & Reklamlar", href: "/admin/sponsors", icon: Megaphone, allowedRoles: ["super_admin", "admin"] },
      { label: "Finans Kayıtları", href: "/admin/financial-logs", icon: ClipboardList, allowedRoles: ["super_admin"] },
    ] },
    { label: "Güvenlik & Sistem", links: [
      { label: "Yasal Erişim Kayıtları", href: "/admin/legal-logs", icon: Fingerprint, allowedRoles: ["super_admin"] },
      { label: "Denetim Günlüğü", href: "/admin/audit-logs", icon: ShieldAlert, allowedRoles: ["super_admin"] },
      { label: "Sistem Ayarları", href: "/admin/settings", icon: SlidersHorizontal, allowedRoles: ["super_admin"] },
    ] },
  ],
  shop: [
    { label: "Dükkan Operasyonu", links: [
      { label: "Günlük Özet", href: "/shop/dashboard", icon: LayoutDashboard },
      { label: "Randevu Takvimi", href: "/shop/calendar", icon: CalendarDays },
      { label: "Koltuk & Personel", href: "/shop/staff", icon: Armchair },
      { label: "Müşteri Hesapları", href: "/shop/customers", icon: Users },
    ] },
    { label: "Katalog & Vitrin", links: [
      { label: "Hizmet & Fiyat Listesi", href: "/shop/services", icon: Scissors },
      { label: "Fotoğraf Galerisi", href: "/shop/gallery", icon: GalleryVerticalEnd },
      { label: "Müşteri Değerlendirmeleri", href: "/shop/reviews", icon: Star },
    ] },
    { label: "Hesap & Hakediş", links: [
      { label: "Gelir & Hakediş Özeti", href: "/shop/payouts", icon: Wallet },
      { label: "İndirim Kuponları", href: "/shop/coupons", icon: BadgePercent },
      { label: "Çalışma & Mola Saatleri", href: "/shop/hours", icon: Clock3 },
      { label: "Dükkan Profili", href: "/shop/profile", icon: Building2 },
    ] },
  ],
  sponsor: [
    { label: "Kampanyalar", links: [
      { label: "Performans Özeti", href: "/sponsor/dashboard", icon: LayoutDashboard },
      { label: "Reklam Kampanyaları", href: "/sponsor/campaigns", icon: Megaphone },
      { label: "Bölge & İlçe Hedefleme", href: "/sponsor/targeting", icon: MapPin },
    ] },
    { label: "Finans & Bütçe", links: [
      { label: "Bütçe & Harcamalar", href: "/sponsor/budget", icon: Banknote },
      { label: "Dönüşüm & Tıklama", href: "/sponsor/analytics", icon: ChartNoAxesCombined },
      { label: "Faturalar & Bakiye", href: "/sponsor/billing", icon: Receipt },
      { label: "Süper Admin Destek", href: "/sponsor/support", icon: ShieldAlert },
    ] },
  ],
};

function pagesFor(role: PortalRole): Record<string, PortalPageData> {
  return Object.fromEntries(
    NAVIGATION[role].flatMap((group) => group.links).map((link) => {
      const slug = link.href.split("/").at(-1) ?? "";
      return [slug, {
        role,
        slug,
        title: link.label,
        description: "Gerçek API verisi gösterilir. Bu modül için canlı bağlantı henüz kurulmadıysa örnek veri gösterilmez.",
        metrics: [],
      }];
    }),
  );
}

export const PAGE_DATA: Record<PortalRole, Record<string, PortalPageData>> = {
  admin: pagesFor("admin"),
  shop: pagesFor("shop"),
  sponsor: pagesFor("sponsor"),
};
