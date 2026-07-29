import type { NextResponse } from "next/server";
import { ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL } from "./config";

export const ACCESS_COOKIE = "np_access";
export const REFRESH_COOKIE = "np_refresh";

function isProd() {
  return process.env.NODE_ENV === "production";
}

function ttlToSeconds(ttl: string, fallback: number): number {
  const m = ttl.match(/^(\d+)([smhd])$/i);
  if (!m) return fallback;
  const n = Number(m[1]);
  const u = m[2].toLowerCase();
  if (u === "s") return n;
  if (u === "m") return n * 60;
  if (u === "h") return n * 3600;
  if (u === "d") return n * 86400;
  return fallback;
}

const base = {
  httpOnly: true,
  secure: isProd(),
  sameSite: "lax" as const,
  path: "/",
};

export function applyAuthCookies(
  res: NextResponse,
  tokens: { accessToken: string; refreshToken: string }
) {
  res.cookies.set(ACCESS_COOKIE, tokens.accessToken, {
    ...base,
    maxAge: ttlToSeconds(ACCESS_TOKEN_TTL, 900),
  });
  res.cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
    ...base,
    maxAge: ttlToSeconds(REFRESH_TOKEN_TTL, 604800),
  });
}

export function clearAuthCookies(res: NextResponse) {
  res.cookies.set(ACCESS_COOKIE, "", { ...base, maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, "", { ...base, maxAge: 0 });
}

export function parseCookieHeader(
  cookieHeader: string | null,
  name: string
): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}
