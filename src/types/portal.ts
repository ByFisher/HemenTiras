import type { LucideIcon } from "lucide-react";
import type { UserRole } from "@/types/api";

export type PortalRole = "admin" | "shop" | "sponsor";
export type AuthRole = "super_admin" | "admin" | "moderator" | "shop_owner" | "staff" | "customer" | "sponsor";
export type RecordStatus =
  | "Onay Bekliyor"
  | "Aktif"
  | "Askıda"
  | "Ödendi"
  | "İtiraz"
  | "Kuyrukta"
  | "Başarısız"
  | "Canlı"
  | "Duraklatıldı"
  | "Yanıt Bekliyor"
  | "Yanıtlandı"
  | "Taslak";
export type AdminEntityView = "customers" | "shops" | "sponsors";
export type SponsorApprovalKind = "campaign" | "budget" | "targeting";

export interface ShopCustomer {
  id: string;
  firstName: string;
  maskedSurname: string;
  maskedPhone: string;
  lastAppointmentAt: string;
  appointmentStatus: "active" | "completed";
  appointmentDate: string;
  hasContactConsent: boolean;
}

export interface CustomerContact {
  fullName: string;
  phone: string;
  expiresAt: string;
}

export interface SponsorApprovalRequest {
  id: string;
  kind: SponsorApprovalKind | "support";
  title: string;
  details: string;
  createdAt: string;
  status: "Onay Bekliyor" | "Onaylandı" | "Reddedildi" | "Yanıt Bekliyor" | "Yanıtlandı";
}

export interface ShopService {
  id: string;
  name: string;
  category: string;
  description: string;
  durationMinutes: number;
  price: number;
  status: "active" | "inactive";
}

export interface WeeklyWorkDay {
  day: string;
  enabled: boolean;
  start: string;
  end: string;
  breakStart: string;
  breakEnd: string;
}

export interface ShopShift {
  id: string;
  name: string;
  approvalStatus: ApprovalStatus;
  workingHours: WeeklyWorkDay[];
}

export interface ShopHoursData {
  workingHours: WeeklyWorkDay[];
  shifts: ShopShift[];
}

export interface ShopGalleryImage {
  id: string;
  kind: ShopContentKind;
  title: string;
  description: string;
  previewUrl?: string;
  relatedEntityId?: string;
  approvalStatus: ApprovalStatus;
  isApproved: boolean;
  createdAt: string;
  rejectionReason?: string;
}

export interface ShopReview {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  staffName: string;
  customerFirstName: string;
}

export interface ShopReviewsData {
  averageRating: number;
  reviewCount: number;
  reviews: ShopReview[];
}

export interface StaffSkill {
  name: string;
  rating: number;
}

export interface StaffWorkLog {
  date: string;
  workSummary: string;
  completedAppointments: number;
}

export interface ShopStaffMember {
  id: string;
  firstName: string;
  lastName: string;
  title: "Berber" | "Kalfa" | "Çırak";
  experienceYears: number;
  biography: string;
  photoUrl?: string;
  pendingPhotoUrl?: string;
  approvalStatus: "approved" | "pending_approval" | "rejected";
  isApproved: boolean;
  ownerRating: number;
  customerRatings: number[];
  completedAppointmentCount: number;
  schedule: WeeklyWorkDay[];
  skills: StaffSkill[];
  workLogs: StaffWorkLog[];
}

export type ShopContentKind = "profile_image" | "cover_image" | "staff_profile" | "staff_photo" | "shop_information" | "gallery_image";
export type ApprovalStatus = "pending_approval" | "approved" | "rejected";

export interface ShopContentSubmission {
  id: string;
  kind: ShopContentKind;
  title: string;
  description: string;
  previewUrl?: string;
  relatedEntityId?: string;
  approvalStatus: ApprovalStatus;
  isApproved: boolean;
  createdAt: string;
  rejectionReason?: string;
}

export interface PortalUser {
  name: string;
  role: AuthRole;
  shopName?: string;
}

export interface NavLink {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  allowedRoles?: UserRole[];
}

export interface PortalNavGroup {
  label: string;
  links: NavLink[];
}

export interface PortalMetric {
  label: string;
  value: string;
  detail: string;
  trend?: "up" | "down" | "neutral";
}

export interface PortalRecord {
  id: string;
  title: string;
  subtitle: string;
  fields: string[];
  status: RecordStatus;
  entityType?: AdminEntityView | "barber";
}

export interface PortalPageData {
  role: PortalRole;
  slug: string;
  title: string;
  description: string;
  metrics: PortalMetric[];
  columns?: string[];
  records?: PortalRecord[];
  chart?: { label: string; value: number }[];
  action?: string;
}
