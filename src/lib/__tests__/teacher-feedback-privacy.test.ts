import { describe, it, expect, beforeEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { resolveDataDir } from "../config";
import { submitTeacherFeedbackTool, listTeacherFeedbackTool } from "../services/tools";
import { TEACHER_FEEDBACK_FILE_PATH } from "../teacher-feedback";
import { hasPermission } from "../auth/rbac";
import { DEFAULT_TENANT_ID } from "../auth/config";
import type { ServiceContext } from "../services/context";

const DATA_FILE = path.join(resolveDataDir(path.join(process.cwd(), "data")), "store.json");

function ctx(overrides?: Partial<ServiceContext>): ServiceContext {
  return {
    role: "PARENT",
    userId: "u1",
    tenantId: DEFAULT_TENANT_ID,
    studentId: "s1",
    channel: "web",
    ...overrides,
  };
}

const VALID_FEEDBACK = {
  studentId: "s1",
  scores: { iletisim: 5, sabir: 4, alanBilgisi: 5 },
  comment: "Çok iyi bir öğretmen",
};

beforeEach(async () => {
  await fs.rm(DATA_FILE, { force: true });
  await fs.rm(TEACHER_FEEDBACK_FILE_PATH, { force: true });
});

describe("EPIC 6C — submitTeacherFeedbackTool: yalnızca kendi çocuğu/kendisi için", () => {
  it("PARENT kendi çocuğu için geri bildirim gönderebilir", async () => {
    const result = await submitTeacherFeedbackTool(ctx({ role: "PARENT", studentId: "s1" }), VALID_FEEDBACK);
    expect(result.ok).toBe(true);
  });

  it("STUDENT kendisi için geri bildirim gönderebilir", async () => {
    const result = await submitTeacherFeedbackTool(ctx({ role: "STUDENT", studentId: "s1" }), VALID_FEEDBACK);
    expect(result.ok).toBe(true);
  });

  it("PARENT başka bir çocuk için geri bildirim gönderemez (FORBIDDEN)", async () => {
    const result = await submitTeacherFeedbackTool(ctx({ role: "PARENT", studentId: "s2" }), VALID_FEEDBACK);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
  });

  it("TEACHER/SCHOOL_ADMIN geri bildirim gönderemez", async () => {
    const asTeacher = await submitTeacherFeedbackTool(
      ctx({ role: "TEACHER", teacherId: "t1", studentId: undefined }),
      VALID_FEEDBACK
    );
    expect(asTeacher.ok).toBe(false);

    const asAdmin = await submitTeacherFeedbackTool(
      ctx({ role: "SCHOOL_ADMIN", studentId: undefined }),
      VALID_FEEDBACK
    );
    expect(asAdmin.ok).toBe(false);
  });

  it("puan aralığı dışı (0 veya 6) VALIDATION_ERROR döner", async () => {
    const result = await submitTeacherFeedbackTool(ctx({ role: "PARENT", studentId: "s1" }), {
      studentId: "s1",
      scores: { iletisim: 6 },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("EPIC 6C — gizlilik: yalnızca SCHOOL_ADMIN/SUPER_ADMIN görebilir, öğretmen kendi geri bildirimini GÖREMEZ", () => {
  it("RBAC kataloğunda TEACHER rolünün teacher_feedback:read izni YOK", () => {
    expect(hasPermission("TEACHER", "teacher_feedback:read")).toBe(false);
  });

  it("listTeacherFeedbackTool TEACHER için FORBIDDEN döner", async () => {
    await submitTeacherFeedbackTool(ctx({ role: "PARENT", studentId: "s1" }), VALID_FEEDBACK);
    const result = await listTeacherFeedbackTool(ctx({ role: "TEACHER", teacherId: "t1", studentId: undefined }), {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
  });

  it("listTeacherFeedbackTool PARENT/STUDENT için de FORBIDDEN döner", async () => {
    await submitTeacherFeedbackTool(ctx({ role: "PARENT", studentId: "s1" }), VALID_FEEDBACK);
    const asParent = await listTeacherFeedbackTool(ctx({ role: "PARENT", studentId: "s1" }), {});
    expect(asParent.ok).toBe(false);
  });

  it("SCHOOL_ADMIN gönderilen geri bildirimi görebilir", async () => {
    await submitTeacherFeedbackTool(ctx({ role: "PARENT", studentId: "s1" }), VALID_FEEDBACK);
    const result = await listTeacherFeedbackTool(ctx({ role: "SCHOOL_ADMIN", studentId: undefined }), {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.feedback).toHaveLength(1);
    expect(result.data.feedback[0].teacherId).toBe("t1");
    expect(result.data.feedback[0].status).toBe("pending");
  });

  it("teacherId filtresiyle yalnızca o öğretmenin geri bildirimleri döner", async () => {
    await submitTeacherFeedbackTool(ctx({ role: "PARENT", studentId: "s1" }), VALID_FEEDBACK); // t1
    await submitTeacherFeedbackTool(ctx({ role: "PARENT", studentId: "s2" }), {
      ...VALID_FEEDBACK,
      studentId: "s2",
    }); // t2

    const result = await listTeacherFeedbackTool(ctx({ role: "SCHOOL_ADMIN", studentId: undefined }), {
      teacherId: "t2",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.feedback).toHaveLength(1);
    expect(result.data.feedback[0].teacherId).toBe("t2");
  });
});
