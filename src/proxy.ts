import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@/types/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");

export async function proxy(request: NextRequest) {
  const cookie = request.headers.get("cookie");
  if (!API_BASE_URL || !cookie) return NextResponse.next();

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/me`, {
      headers: {
        Accept: "application/json",
        Cookie: cookie,
        Origin: request.nextUrl.origin,
        Referer: request.url,
      },
      cache: "no-store",
    });

    if (!response.ok) return NextResponse.next();

    const user = await response.json() as User;
    const { pathname } = request.nextUrl;

    if (user.role === "shop_owner" && user.status === "pending_approval" && pathname !== "/approval-pending") {
      return NextResponse.redirect(new URL("/approval-pending", request.url));
    }

    if (user.role === "customer" && (pathname === "/shop" || pathname.startsWith("/shop/"))) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  } catch (error) {
    console.error("Could not verify the Sanctum session in Next.js Proxy.", error);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
