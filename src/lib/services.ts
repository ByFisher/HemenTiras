import { del, downloadFile, get, patch, post, put, requestList } from "@/lib/api-client";
import type {
  AdminApproval,
  Appointment,
  AppointmentSlot,
  AdminSlider,
  AdminRole,
  AdminStaff,
  AccessLog,
  AdminReview,
  CreateAppointmentInput,
  CouponQuote,
  EntityType,
  MaskedUser,
  Paginated,
  Service,
  Shop,
  Staff,
  StaffReview,
  Sponsor,
  User,
  UserRole,
} from "@/types/api";
import type { SponsorApprovalRequest } from "@/types/portal";

/* ------------------------------------------------------------------ */
/* Süper Admin                                                         */
/* ------------------------------------------------------------------ */

export interface AdminDirectoryFilters {
  search?: string;
  status?: string;
  city?: string;
  page?: number;
  perPage?: number;
}

/** Admin dizin uçlarının tek doğruluk kaynağı. */
export const ADMIN_ENTITY_PATH: Record<EntityType, string> = {
  customers: "/admin/users",
  shops: "/admin/shops",
  sponsors: "/admin/sponsors",
};

export const adminApi = {
  staff: () => requestList<AdminStaff>("/admin/staff"),

  createStaff: (input: { name: string; email: string; phone: string; password: string; role: AdminRole }) =>
    post<AdminStaff>("/admin/staff", input),

  updateStaffRole: (userId: string, role: UserRole) =>
    patch<AdminStaff>(`/admin/staff/${encodeURIComponent(userId)}/role`, { role }),

  accessLogs: (filters: AccessLogFilters = {}) =>
    get<Paginated<AccessLog>>("/admin/access-logs", {
      query: {
        ip: filters.ip,
        from: filters.from,
        to: filters.to,
        user_id: filters.userId,
        device_type: filters.deviceType,
        method: filters.method,
        page: filters.page,
        per_page: filters.perPage,
      },
    }),

  exportAccessLogs: (filters: AccessLogFilters = {}) =>
    downloadFile("/admin/access-logs/export", {
      ip: filters.ip,
      from: filters.from,
      to: filters.to,
      user_id: filters.userId,
      device_type: filters.deviceType,
      method: filters.method,
    }),

  reviews: (status: AdminReview["status"] = "pending_approval") =>
    get<Paginated<AdminReview>>("/admin/reviews", { query: { status, per_page: 50 } }),

  approveReview: (reviewId: string) =>
    patch<AdminReview>(`/admin/reviews/${encodeURIComponent(reviewId)}/approve`),

  deleteReview: (reviewId: string) =>
    del<{ message: string }>(`/admin/reviews/${encodeURIComponent(reviewId)}`),

  supportRequests: () => requestList<SponsorApprovalRequest>("/admin/support-requests"),

  decideSupportRequest: (requestId: string, decision: "approve" | "reject") =>
    post<SponsorApprovalRequest>(`/admin/support-requests/${encodeURIComponent(requestId)}/${decision}`),

  sliders: () => requestList<AdminSlider>("/admin/sliders"),

  createSlider: (input: FormData) => post<AdminSlider>("/admin/sliders", input),

  updateSlider: (id: string, input: FormData) => {
    input.set("_method", "PATCH");
    return post<AdminSlider>(`/admin/sliders/${encodeURIComponent(id)}`, input);
  },

  setSliderActive: (id: string, isActive: boolean) =>
    patch<AdminSlider>(`/admin/sliders/${encodeURIComponent(id)}`, { is_active: isActive }),

  reorderSliders: (ids: string[]) => patch<AdminSlider[]>("/admin/sliders/order", { ids }),

  deleteSlider: (id: string) => del<void>(`/admin/sliders/${encodeURIComponent(id)}`),

  shops: (filters: AdminDirectoryFilters = {}) =>
    requestList<Shop>("/admin/shops", {
      query: {
        search: filters.search,
        status: filters.status,
        city: filters.city,
        page: filters.page,
        per_page: filters.perPage,
      },
    }),

  /** KVKK: dönen kayıtlar maskelidir, tam iletişim bilgisi içermez. */
  users: (filters: AdminDirectoryFilters = {}) =>
    requestList<MaskedUser>("/admin/users", {
      query: {
        search: filters.search,
        status: filters.status,
        page: filters.page,
        per_page: filters.perPage,
      },
    }),

  sponsors: (filters: AdminDirectoryFilters = {}) =>
    requestList<Sponsor>("/admin/sponsors", {
      query: {
        search: filters.search,
        status: filters.status,
        page: filters.page,
        per_page: filters.perPage,
      },
    }),

  setUserStatus: (userId: string, status: "active" | "suspended") =>
    patch<MaskedUser>(`/admin/users/${encodeURIComponent(userId)}/status`, { status }),

  setShopStatus: (shopId: string, status: "active" | "suspended") =>
    patch<Shop>(`/admin/shops/${encodeURIComponent(shopId)}/status`, { status }),

  approvals: (status: AdminApproval["status"] = "pending_approval") =>
    requestList<AdminApproval>("/admin/approvals", { query: { status } }),

  approve: (approvalId: string) =>
    patch<AdminApproval>(`/admin/approvals/${encodeURIComponent(approvalId)}/approve`),

  reject: (approvalId: string, rejectionReason: string) =>
    patch<AdminApproval>(`/admin/approvals/${encodeURIComponent(approvalId)}/reject`, { rejection_reason: rejectionReason }),
};

export interface AccessLogFilters {
  ip?: string;
  from?: string;
  to?: string;
  userId?: string;
  deviceType?: AccessLog["deviceType"];
  method?: string;
  page?: number;
  perPage?: number;
}

/* ------------------------------------------------------------------ */
/* B2C — Müşteri paneli                                                 */
/* ------------------------------------------------------------------ */

export interface ShopSearchFilters {
  search?: string;
  city?: string;
  district?: string;
  /** Hizmet adına göre filtreleme */
  service?: string;
  minRating?: number;
  sort?: "rating_desc" | "rating_asc" | "name_asc" | "reviews_desc";
  page?: number;
  perPage?: number;
}

export const shopApi = {
  /** Yalnızca admin onaylı ve aktif dükkanlar döner. */
  search: (filters: ShopSearchFilters = {}) =>
    requestList<Shop>("/shops", {
      query: {
        search: filters.search,
        city: filters.city,
        district: filters.district,
        service: filters.service,
        min_rating: filters.minRating,
        sort: filters.sort,
        page: filters.page,
        per_page: filters.perPage,
      },
    }),

  detail: (shopId: string) => get<Shop>(`/shops/${encodeURIComponent(shopId)}`),

  services: (shopId: string) =>
    requestList<Service>(`/shops/${encodeURIComponent(shopId)}/services`, { query: { is_active: true } }),

  staff: (shopId: string) => requestList<Staff>(`/shops/${encodeURIComponent(shopId)}/staff`),

  staffDetail: (shopId: string, staffId: string) =>
    get<Staff>(`/shops/${encodeURIComponent(shopId)}/staff/${encodeURIComponent(staffId)}`),

  staffReviews: (shopId: string, staffId: string) =>
    requestList<StaffReview>(`/shops/${encodeURIComponent(shopId)}/staff/${encodeURIComponent(staffId)}/reviews`),

  /** Seçilen personel + hizmet için uygun randevu saatleri. */
  availability: (shopId: string, staffId: string, serviceIds: string[], date: string) =>
    requestList<AppointmentSlot>(
      `/shops/${encodeURIComponent(shopId)}/staff/${encodeURIComponent(staffId)}/availability`,
      { query: { service_ids: serviceIds.join(","), date } },
    ),

  favoriteIds: () => requestList<string>("/user/favorites"),

  favorite: (shopId: string) =>
    put<{ shopId: string; isFavorite: boolean }>(`/user/favorites/${encodeURIComponent(shopId)}`),

  unfavorite: (shopId: string) =>
    del<{ shopId: string; isFavorite: boolean }>(`/user/favorites/${encodeURIComponent(shopId)}`),
};

export interface AppointmentFilters {
  status?: Appointment["status"] | "upcoming" | "past";
  page?: number;
  perPage?: number;
}

export const appointmentApi = {
  list: (filters: AppointmentFilters = {}) =>
    requestList<Appointment>("/appointments", {
      query: { status: filters.status, page: filters.page, per_page: filters.perPage },
    }),

  active: () => requestList<Appointment>("/user/active-appointments"),

  detail: (appointmentId: string) => get<Appointment>(`/appointments/${encodeURIComponent(appointmentId)}`),

  create: (input: CreateAppointmentInput) => post<Appointment>("/appointments", input),

  cancel: (appointmentId: string, reason?: string) =>
    post<Appointment>(`/appointments/${encodeURIComponent(appointmentId)}/cancel`, { reason }),

  demoPay: (appointmentId: string) =>
    post<Appointment>(`/appointments/${encodeURIComponent(appointmentId)}/demo-pay`),

  startIyzicoCheckout: (appointmentId: string, identityNumber: string, registrationAddress: string) =>
    post<{ checkoutUrl: string }>(`/appointments/${encodeURIComponent(appointmentId)}/checkout`, {
      identityNumber,
      registrationAddress,
    }),

  verifyIyzicoCheckout: (appointmentId: string) =>
    post<Appointment>(`/appointments/${encodeURIComponent(appointmentId)}/checkout/verify`),

  /** Tamamlanmış randevu için 1-5 yıldız + yorum. */
  review: (appointmentId: string, rating: number, comment?: string) =>
    post<StaffReview>(`/appointments/${encodeURIComponent(appointmentId)}/review`, {
      rating,
      comment: comment?.trim() || null,
    }),
};

export const couponApi = {
  validate: (input: { shopId: string; code: string; basketAmount: number }) =>
    post<CouponQuote>("/coupons/validate", {
      shop_id: input.shopId,
      code: input.code,
      basket_amount: input.basketAmount,
    }),
};

export const shopAppointmentApi = {
  list: (status?: Appointment["status"]) =>
    requestList<Appointment>("/shop/appointments", { query: { status } }),

  cancel: (appointmentId: string, reason?: string) =>
    post<Appointment>(`/shop/appointments/${encodeURIComponent(appointmentId)}/cancel`, { reason }),
};

export const profileApi = {
  update: (input: { fullName: string; phone: string; avatar?: File }) => {
    const body = new FormData();
    body.set("fullName", input.fullName);
    body.set("phone", input.phone);
    if (input.avatar) body.set("avatar", input.avatar);
    return put<User>("/user/profile", body);
  },
};

export const meApi = {
  profile: () => get<User>("/me"),
};
