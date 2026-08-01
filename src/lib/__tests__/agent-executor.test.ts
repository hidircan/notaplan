import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../agent/logging", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../agent/logging")>();
  return { ...actual, logAgentEvent: vi.fn() };
});

import { executeAgentTool, listToolsForRole } from "../agent/executor";
import { logAgentEvent } from "../agent/logging";
import { DEFAULT_TENANT_ID } from "../auth/config";
import type { ServiceContext } from "../services/context";

function ctx(overrides?: Partial<ServiceContext>): ServiceContext {
  return {
    role: "SCHOOL_ADMIN",
    userId: "u1",
    tenantId: DEFAULT_TENANT_ID,
    channel: "web",
    ...overrides,
  };
}

describe("agent executor", () => {
  beforeEach(() => {
    vi.mocked(logAgentEvent).mockClear();
  });

  it("bilinmeyen tool için NOT_FOUND döner", async () => {
    const res = await executeAgentTool(ctx(), {
      tool: "nope" as never,
      input: {},
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("NOT_FOUND");
    }
  });

  it("rol yetkisiz tool için FORBIDDEN döner", async () => {
    const res = await executeAgentTool(ctx({ role: "PARENT" }), {
      tool: "resetDemo",
      input: {},
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("FORBIDDEN");
    }
  });

  it("geçersiz input için VALIDATION_ERROR döner", async () => {
    // branchId artık serbest bir string (dinamik şubeler) — şema düzeyinde
    // geçersizliği göstermek için boş string kullanılır (.min(1) ihlali).
    const res = await executeAgentTool(ctx(), {
      tool: "findAvailableTeachers",
      input: { branchId: "" },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("PARENT kendi öğrencisinin programını görebilir", async () => {
    const res = await executeAgentTool(
      ctx({ role: "PARENT", studentId: "s1" }),
      { tool: "getStudentSchedule", input: { studentId: "s1" } }
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      const result = res.data.result as { lessons: unknown[] };
      expect(Array.isArray(result.lessons)).toBe(true);
    }
  });

  it("PARENT başkasının programına erişemez", async () => {
    const res = await executeAgentTool(
      ctx({ role: "PARENT", studentId: "s1" }),
      { tool: "getStudentSchedule", input: { studentId: "s2" } }
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("FORBIDDEN");
    }
  });

  it("AI_AGENT öğretmen listesi çekebilir", async () => {
    const res = await executeAgentTool(ctx({ role: "AI_AGENT" }), {
      tool: "findAvailableTeachers",
      input: { instrument: "Piyano" },
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const result = res.data.result as { teachers: unknown[] };
      expect(result.teachers.length).toBeGreaterThan(0);
    }
  });

  it("listToolsForRole PARENT için yalnızca izinli tool'ları döner", () => {
    const tools = listToolsForRole("PARENT");
    const names = tools.map((t) => t.name);
    expect(names).toContain("getStudentSchedule");
    expect(names).not.toContain("resetDemo");
    expect(names).not.toContain("createStudent");
  });
});
