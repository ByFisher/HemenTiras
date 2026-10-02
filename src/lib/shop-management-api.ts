import { get, patch, post, put, requestList } from "@/lib/api-client";
import type {
  ApprovalStatus,
  ShopContentKind,
  ShopContentSubmission,
  ShopHoursData,
  ShopService,
  ShopStaffMember,
  WeeklyWorkDay,
  StaffSkill,
} from "@/types/portal";

export type ShopServiceInput = Omit<ShopService, "id">;
export type ShopServiceField = keyof ShopServiceInput;
export interface ShopProfileData {
  id: string;
  name: string;
  phone: string | null;
  address: string;
  description: string;
  profileImageUrl: string | null;
  coverImageUrl: string | null;
}

export interface ShopStaffInput {
  firstName: string;
  lastName: string;
  title: ShopStaffMember["title"];
  experienceYears: number;
  biography: string;
  schedule: WeeklyWorkDay[];
  skills: StaffSkill[];
}

export type ShopStaffUpdateInput = Pick<
  ShopStaffMember,
  "firstName" | "lastName" | "title" | "experienceYears" | "biography" | "schedule" | "skills" | "workLogs"
>;

export const getShopProfile = () => get<ShopProfileData>("/shop/profile");

export const updateShopHours = (workingHours: WeeklyWorkDay[]) =>
  put<ShopHoursData>("/shop/hours", { workingHours });

export const getShopServices = () => requestList<ShopService>("/shop/services");

export const createShopService = (input: ShopServiceInput) => post<ShopService>("/shop/services", input);

export const updateShopServiceField = <K extends ShopServiceField>(
  id: string,
  field: K,
  value: ShopServiceInput[K],
) => patch<ShopService>(`/shop/services/${encodeURIComponent(id)}`, { [field]: value });

export const getShopStaff = () => requestList<ShopStaffMember>("/shop/staff", { query: { include: "performance" } });

export const createShopStaff = (input: ShopStaffInput) => post<ShopStaffMember>("/shop/staff", input);

export const updateShopStaff = (id: string, input: ShopStaffUpdateInput) =>
  put<ShopStaffMember>(`/shop/staff/${encodeURIComponent(id)}`, input);

export const createShopContentSubmission = (input: {
  kind: ShopContentKind;
  title: string;
  description: string;
  previewUrl?: string;
  relatedEntityId?: string;
  payload?: Record<string, string>;
}) => post<ShopContentSubmission>("/shop/content-submissions", {
  kind: input.kind,
  title: input.title,
  description: input.description,
  related_entity_id: input.relatedEntityId,
  payload: input.payload,
});

export const getShopContentSubmissions = () => requestList<ShopContentSubmission>("/shop/content-submissions");

export async function uploadShopContentImage(
  file: File,
  kind: Extract<ShopContentKind, "profile_image" | "cover_image" | "staff_photo" | "gallery_image">,
  title: string,
  relatedEntityId?: string,
) {
  if (file.size > 5 * 1024 * 1024) throw new Error("Görsel boyutu en fazla 5 MB olabilir.");
  if (!file.type.startsWith("image/")) throw new Error("Yalnızca görsel dosyaları yüklenebilir.");

  const formData = new FormData();
  formData.set("file", file);
  formData.set("kind", kind);
  formData.set("title", title);
  if (relatedEntityId) formData.set("related_entity_id", relatedEntityId);

  return post<ShopContentSubmission>("/shop/content-submissions", formData);
}

export const getAdminContentApprovalQueue = () =>
  requestList<ShopContentSubmission>("/admin/content-approval-queue");

export const decideShopContentSubmission = (
  id: string,
  decision: Extract<ApprovalStatus, "approved" | "rejected">,
  rejectionReason?: string,
) => post<ShopContentSubmission>(
  `/admin/content-approval-queue/${encodeURIComponent(id)}/${decision}`,
  decision === "rejected" ? { rejection_reason: rejectionReason } : undefined,
);
