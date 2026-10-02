import { get, post } from "@/lib/api-client";
import type { User } from "@/types/api";

export async function login(credentials: { email: string; password: string }) {
  const user = await post<User>("/auth/login", credentials);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("hementiras:auth-changed"));
    window.dispatchEvent(new Event("hementiras:splash"));
  }
  return user;
}

export interface RegistrationInput {
  name: string;
  email: string;
  phone?: string;
  city: string;
  district: string;
  password: string;
  password_confirmation: string;
}

export const register = (details: RegistrationInput) => post<User>("/auth/register", details);

export interface CustomerRegistrationInput {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  city: string;
  district: string;
}

export const registerCustomer = (details: CustomerRegistrationInput) =>
  post<User>("/auth/register-customer", details);

export interface ShopOwnerApplicationInput {
  fullName: string;
  email: string;
  password: string;
  shopName: string;
  phone: string;
  city: string;
  district: string;
}

export interface ShopOwnerApplicationResult {
  message: string;
  user: User;
}

export const registerShopOwner = (details: ShopOwnerApplicationInput) =>
  post<ShopOwnerApplicationResult>("/auth/register-shop", details);

export async function logout() {
  const result = await post<{ message: string }>("/auth/logout");
  if (typeof window !== "undefined") window.dispatchEvent(new Event("hementiras:auth-changed"));
  return result;
}

export const currentUser = () => get<User>("/me");

export function userDestination(user: User) {
  if (["super_admin", "admin", "moderator"].includes(user.role)) return "/admin/dashboard";
  if (user.role === "shop_owner") return user.status === "pending_approval" ? "/approval-pending" : "/shop/dashboard";
  if (user.role === "sponsor") return "/sponsor/support";
  if (user.role === "customer") return "/shops";
  return "/login";
}
