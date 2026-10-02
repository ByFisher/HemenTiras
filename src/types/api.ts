/** HemenTıraş B2B/B2C API sözleşmesi — Laravel backend ile paylaşılan alan tipleri. */

export type ISODate = string; // YYYY-MM-DD
export type ISODateTime = string; // ISO-8601

export type UserRole = "super_admin" | "admin" | "moderator" | "shop_owner" | "staff" | "customer" | "sponsor";
export type UserStatus = "active" | "approved" | "suspended" | "pending_approval";
export type EntityType = "customers" | "shops" | "sponsors";
export type AdminRole = "super_admin" | "admin" | "moderator";

export interface AdminStaff {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: ISODateTime | null;
}

export interface AccessLog {
  id: string;
  occurredAtUtc: ISODateTime;
  occurredAtLocal: ISODateTime;
  ipAddress: string | null;
  clientPort: number | null;
  userId: string | null;
  anonymousVisitorId: string | null;
  deviceType: "desktop" | "mobile" | "tablet" | "bot" | "unknown";
  userAgent: string | null;
  method: string;
  path: string;
  status: number;
  privacyNoticeVersion: string | null;
  noticeAcknowledgedAt: ISODateTime | null;
  explicitConsentPurpose: string | null;
  explicitConsentVersion: string | null;
  explicitConsentGranted: boolean | null;
  explicitConsentAt: ISODateTime | null;
}

export interface AdminReview {
  id: string;
  rating: number;
  comment: string | null;
  status: "pending_approval" | "approved";
  createdAt: ISODateTime;
  customerFirstName: string;
  staffName: string;
  shopName: string | null;
}

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  city: string | null;
  district: string | null;
  role: UserRole;
  status: UserStatus;
  avatarUrl: string | null;
  shopId: string | null;
  shopName?: string | null;
  hasContactConsent: boolean;
  createdAt: ISODateTime;
  lastLoginAt: ISODateTime | null;
}

export interface City {
  id: string;
  name: string;
  plateCode: string;
}

export interface District {
  id: string;
  name: string;
  city: City;
}

export interface Address {
  district: District;
  street: string;
  fullAddress: string;
  latitude: number | null;
  longitude: number | null;
}

export interface WorkingHour {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Pazar
  isClosed: boolean;
  opensAt: string | null; // HH:mm
  closesAt: string | null; // HH:mm
  breakStartsAt: string | null;
  breakEndsAt: string | null;
}

export type ShopStatus = "pending_approval" | "active" | "suspended" | "passive";

export interface Shop {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: ShopStatus;
  isApproved?: boolean;
  /** Yalnızca admin onayından geçmiş görseller müşteriye döner. */
  coverImageUrl: string | null;
  profileImageUrl: string | null;
  address: Address;
  phone: string;
  workingHours: WorkingHour[];
  averageRating: number;
  reviewCount: number;
  minimumServicePrice?: number | null;
  services?: Service[];
  commissionRate: number;
  createdAt: ISODateTime;
}

export interface SliderSlide {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  linkUrl: string | null;
  linkLabel: string | null;
}

export interface AdminSlider extends SliderSlide {
  isActive: boolean;
  sortOrder: number;
}

export interface Service {
  id: string;
  shopId: string;
  name: string;
  category: string;
  description: string;
  durationMinutes: number;
  price: number;
  isActive: boolean;
  sortOrder: number;
}

export type StaffTitle = "Berber" | "Kalfa" | "Çırak";
export type ApprovalStatus = "pending_approval" | "approved" | "rejected";

export interface Staff {
  id: string;
  shopId: string;
  firstName: string;
  lastName: string;
  title: StaffTitle;
  experienceYears: number;
  biography: string;
  photoUrl: string | null;
  approvalStatus: ApprovalStatus;
  isApproved: boolean;
  averageRating: number;
  reviewCount: number;
  completedAppointmentCount: number;
  workingHours: WorkingHour[];
  services: Service[];
}

export type AppointmentStatus = "pending" | "confirmed" | "completed" | "cancelled" | "cancelled_by_shop" | "no_show";

export interface Appointment {
  id: string;
  customerId: string;
  shopId: string;
  staffId: string;
  serviceId: string;
  startsAt: ISODateTime;
  endsAt: ISODateTime;
  status: AppointmentStatus;
  totalPrice: number;
  basePrice?: number;
  discountAmount?: number;
  couponCode?: string | null;
  services?: Pick<Service, "id" | "name" | "durationMinutes" | "price">[];
  note: string | null;
  /** Yalnızca tamamlanmış randevularda döner. */
  isRated: boolean;
  cancellationReason: string | null;
  cancelledAt: ISODateTime | null;
  payment: {
    provider: string;
    method: string | null;
    status: "unpaid" | "pending" | "paid" | "failed" | "refund_pending" | "refunded" | "refund_failed";
    amount: number;
    currency: string;
    refundAmount: number;
  };
  demoPaymentEnabled: boolean;
  shop?: Pick<Shop, "id" | "name" | "coverImageUrl" | "address">;
  staff?: Pick<Staff, "id" | "firstName" | "lastName" | "title" | "photoUrl">;
  service?: Pick<Service, "id" | "name" | "durationMinutes" | "price">;
  createdAt: ISODateTime;
}

export interface AppointmentNotification {
  id: string;
  appointmentId: string;
  type: "status" | "reminder";
  title: string;
  message: string;
  startsAt: ISODateTime;
  shopName: string;
  status: AppointmentStatus;
  unread: boolean;
}

export interface AppointmentSlot {
  startsAt: ISODateTime;
  endsAt: ISODateTime;
  isAvailable: boolean;
}

export interface CreateAppointmentInput {
  shopId: string;
  staffId: string;
  serviceId?: string;
  serviceIds?: string[];
  startsAt: ISODateTime;
  note?: string;
  couponCode?: string;
  paymentMethod?: "card" | "at_shop_card" | "cash";
}

export interface CouponQuote {
  code: string;
  discountAmount: number;
  totalPrice: number;
}

export interface StaffReview {
  id: string;
  appointmentId: string;
  staffId: string;
  customerId: string;
  rating: number; // 1-5
  comment: string | null;
  createdAt: ISODateTime;
  customer?: { id: string; firstName: string; maskedSurname: string };
}

export type ApprovalKind =
  | "shop_profile_image"
  | "shop_cover_image"
  | "shop_information"
  | "staff_profile"
  | "staff_photo";

export interface AdminApproval {
  id: string;
  kind: ApprovalKind;
  title: string;
  description: string;
  previewUrl: string | null;
  relatedEntityId: string | null;
  shopId: string | null;
  shopName: string | null;
  status: ApprovalStatus;
  submittedAt: ISODateTime;
  rejectionReason: string | null;
}

export interface Sponsor {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  status: UserStatus;
  dailyBudget: number;
  createdAt: ISODateTime;
}

/** KVKK: liste uçları yalnızca maskeli kişisel veri döner. */
export interface MaskedUser extends Omit<User, "fullName" | "email" | "phone" | "city" | "district"> {
  firstName: string;
  maskedSurname: string;
  maskedEmail: string;
  maskedPhone: string;
}

export interface Paginated<T> {
  data: T[];
  meta: {
    currentPage: number;
    lastPage: number;
    perPage: number;
    total: number;
  };
}

export interface ApiErrorBody {
  message: string;
  errors?: Record<string, string[]>;
}
