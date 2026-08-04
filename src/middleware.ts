import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth/cookies";

const PROTECTED = ["/panel", "/veli", "/ogretmen", "/ogrenci"];

function getSecret() {
  const secret =
    process.env.JWT_SECRET ||
    (process.env.NODE_ENV === "production"
      ? ""
      : "notaplan-dev-secret-change-me-in-production-32b");
  return new TextEncoder().encode(secret || "notaplan-dev-secret-change-me-in-production-32b");
}

async function hasValidAccess(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, getSecret(), {
      issuer: "notaplan",
      audience: "notaplan-api",
    });
    return true;
  } catch {
    return false;
  }
}

function hasRefresh(request: NextRequest): boolean {
  return Boolean(request.cookies.get(REFRESH_COOKIE)?.value);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  if (!isProtected) return NextResponse.next();

  if (await hasValidAccess(request)) {
    return NextResponse.next();
  }

  // Access expired but refresh present → allow through; session layer refreshes
  if (hasRefresh(request)) {
    return NextResponse.next();
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    "/panel/:path*",
    "/veli/:path*",
    "/ogretmen/:path*",
    "/ogrenci/:path*",
    "/panel",
    "/veli",
    "/ogretmen",
    "/ogrenci",
  ],
};
