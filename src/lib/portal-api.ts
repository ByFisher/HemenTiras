import { post, request, requestList } from "@/lib/api-client";
import type {
  AdminEntityView,
  CustomerContact,
  PortalRecord,
  ShopCustomer,
  SponsorApprovalKind,
  SponsorApprovalRequest,
} from "@/types/portal";

export interface CustomerFilters {
  search?: string;
  appointmentStatus?: "active" | "completed";
}

export interface AdminDirectoryFilters {
  entityType: AdminEntityView;
  status?: string;
  search?: string;
  location?: string;
}

export interface SponsorApprovalInput {
  kind: SponsorApprovalKind | "support";
  title: string;
  details: string;
}

export function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { body, headers, ...options } = init;
  const normalizedBody = typeof body === "string" ? JSON.parse(body) as unknown : body;

  return request<T>(path, {
    ...options,
    headers,
    body: normalizedBody,
  });
}

export function getShopCustomers(filters: CustomerFilters): Promise<ShopCustomer[]> {
  return requestList<ShopCustomer>("/shop/customers", {
    query: {
      search: filters.search,
      appointment_status: filters.appointmentStatus,
    },
  });
}

export function getAdminDirectory(filters: AdminDirectoryFilters): Promise<PortalRecord[]> {
  return requestList<PortalRecord>("/admin/directory", {
    query: {
      entity_type: filters.entityType,
      status: filters.status === "Tümü" ? undefined : filters.status,
      search: filters.search,
      location: filters.location,
    },
  });
}

export async function getShopCustomerContact(customer: ShopCustomer): Promise<CustomerContact> {
  const appointmentToday = customer.appointmentStatus === "active"
    && customer.appointmentDate === new Date().toLocaleDateString("en-CA");
  if (!appointmentToday && !customer.hasContactConsent) {
    throw new Error("Tam iletişim bilgisi için bugün aktif randevu veya müşteri onayı gerekir.");
  }

  return post<CustomerContact>(`/shop/customers/${encodeURIComponent(customer.id)}/contact`, {
    appointment_date: customer.appointmentDate,
  });
}

export function submitSponsorApprovalRequest(input: SponsorApprovalInput): Promise<SponsorApprovalRequest> {
  return post<SponsorApprovalRequest>("/sponsor/approval-requests", input);
}

export function getSponsorApprovalQueue(): Promise<SponsorApprovalRequest[]> {
  return requestList<SponsorApprovalRequest>("/admin/sponsor-approval-requests");
}

export function decideSponsorApprovalRequest(
  requestId: string,
  decision: "approve" | "reject",
): Promise<SponsorApprovalRequest> {
  return post<SponsorApprovalRequest>(
    `/admin/sponsor-approval-requests/${encodeURIComponent(requestId)}/${decision}`,
  );
}
