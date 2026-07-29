import { DEFAULT_TENANT_ID } from "./config";
import type { AppRole, AuthUser } from "./types";
import { APP_ROLES } from "./types";
import { hashPasswordSync, verifyPassword } from "./password";
import { isDbMode } from "../config";

type BootstrapUser = AuthUser & { password: string };

/** In-memory bootstrap identities (json/memory modes) with bcrypt hashes */
const BOOTSTRAP: BootstrapUser[] = [
  {
    userId: "user_super",
    email: "super@notaplan.app",
    password: process.env.AUTH_SUPER_PASSWORD || "demo-super",
    role: "SUPER_ADMIN",
    tenantId: DEFAULT_TENANT_ID,
  },
  {
    userId: "user_admin",
    email: "admin@niluferacar.com.tr",
    password: process.env.AUTH_ADMIN_PASSWORD || "demo-admin",
    role: "SCHOOL_ADMIN",
    tenantId: DEFAULT_TENANT_ID,
  },
  {
    userId: "user_teacher_t2",
    email: "can@niluferacar.com.tr",
    password: process.env.AUTH_TEACHER_PASSWORD || "demo-teacher",
    role: "TEACHER",
    tenantId: DEFAULT_TENANT_ID,
    teacherId: "t2",
  },
  {
    userId: "user_parent_s1",
    email: "selin@email.com",
    password: process.env.AUTH_PARENT_PASSWORD || "demo-parent",
    role: "PARENT",
    tenantId: DEFAULT_TENANT_ID,
    studentId: "s1",
  },
  {
    userId: "user_agent",
    email: "agent@notaplan.app",
    password: process.env.AUTH_AGENT_PASSWORD || "demo-agent",
    role: "AI_AGENT",
    tenantId: DEFAULT_TENANT_ID,
  },
];

const HASHED = BOOTSTRAP.map((u) => ({
  ...u,
  passwordHash: hashPasswordSync(u.password),
}));

function toAuthUser(u: {
  userId: string;
  role: AppRole;
  tenantId: string;
  email?: string;
  teacherId?: string | null;
  studentId?: string | null;
}): AuthUser {
  return {
    userId: u.userId,
    role: u.role,
    tenantId: u.tenantId,
    email: u.email,
    teacherId: u.teacherId ?? undefined,
    studentId: u.studentId ?? undefined,
  };
}

function isAppRole(value: string): value is AppRole {
  return (APP_ROLES as readonly string[]).includes(value);
}

/** Seed users for Prisma (tenant-scoped) */
export function getBootstrapUsersForSeed(tenantId: string) {
  return HASHED.filter((u) => u.tenantId === tenantId || u.role === "SUPER_ADMIN").map(
    (u) => ({
      id: u.userId,
      tenantId,
      email: u.email!,
      passwordHash: u.passwordHash,
      role: u.role,
      teacherId: u.teacherId,
      studentId: u.studentId,
      active: true,
    })
  );
}

export async function authenticateUser(
  email: string,
  password: string
): Promise<AuthUser | null> {
  if (isDbMode) {
    try {
      const { getPrisma } = await import("../db");
      const prisma = getPrisma();
      const row = await prisma.user.findFirst({
        where: { email: email.toLowerCase(), active: true },
      });
      if (!row) return null;
      const valid = await verifyPassword(password, row.passwordHash);
      if (!valid) return null;
      if (!isAppRole(row.role)) return null;
      return toAuthUser({
        userId: row.id,
        role: row.role,
        tenantId: row.tenantId,
        email: row.email,
        teacherId: row.teacherId,
        studentId: row.studentId,
      });
    } catch {
      // fall through to bootstrap if DB unavailable
    }
  }

  const row = HASHED.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!row) return null;
  const valid = await verifyPassword(password, row.passwordHash);
  if (!valid) return null;
  return toAuthUser(row);
}

export async function getUserById(userId: string): Promise<AuthUser | null> {
  if (isDbMode) {
    try {
      const { getPrisma } = await import("../db");
      const prisma = getPrisma();
      const row = await prisma.user.findFirst({
        where: { id: userId, active: true },
      });
      if (!row || !isAppRole(row.role)) return null;
      return toAuthUser({
        userId: row.id,
        role: row.role,
        tenantId: row.tenantId,
        email: row.email,
        teacherId: row.teacherId,
        studentId: row.studentId,
      });
    } catch {
      // fall through
    }
  }

  const row = HASHED.find((u) => u.userId === userId);
  if (!row) return null;
  return toAuthUser(row);
}

/** @deprecated use authenticateUser */
export async function authenticateDemoUser(
  email: string,
  password: string
): Promise<AuthUser | null> {
  return authenticateUser(email, password);
}

export type { AppRole };
