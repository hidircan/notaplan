import { describe, it, expect, beforeEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { resolveDataDir } from "../config";
import {
  computeOverallCurriculumProgress,
  defaultProgressForStatus,
  CURRICULUM_TOPICS_FILE,
} from "../curriculum";
import {
  createCurriculumTopicTool,
  updateCurriculumTopicTool,
  listCurriculumForStudentTool,
} from "../services/tools";
import { DEFAULT_TENANT_ID } from "../auth/config";
import type { ServiceContext } from "../services/context";

const DATA_FILE = path.join(resolveDataDir(path.join(process.cwd(), "data")), "store.json");

function ctx(overrides?: Partial<ServiceContext>): ServiceContext {
  return {
    role: "TEACHER",
    userId: "u_teacher",
    tenantId: DEFAULT_TENANT_ID,
    teacherId: "t1",
    channel: "web",
    ...overrides,
  };
}

beforeEach(async () => {
  await fs.rm(DATA_FILE, { force: true });
  await fs.rm(CURRICULUM_TOPICS_FILE, { force: true });
});

describe("computeOverallCurriculumProgress", () => {
  it("boş liste 0 döner", () => {
    expect(computeOverallCurriculumProgress([])).toBe(0);
  });

  it("eşit ağırlıklı ortalama (açıklanabilir)", () => {
    expect(
      computeOverallCurriculumProgress([{ progressPercent: 0 }, { progressPercent: 100 }])
    ).toBe(50);
  });

  it("status varsayılan progress", () => {
    expect(defaultProgressForStatus("planned")).toBe(0);
    expect(defaultProgressForStatus("in_progress")).toBe(50);
    expect(defaultProgressForStatus("mastered")).toBe(100);
  });
});

describe("createCurriculumTopicTool — ownership", () => {
  it("own-teacher konu oluşturur", async () => {
    const res = await createCurriculumTopicTool(ctx({ teacherId: "t1" }), {
      studentId: "s1",
      title: "Do majör gam",
      status: "planned",
    });
    expect(res.ok).toBe(true);
  });

  it("cross-teacher konu oluşturamaz", async () => {
    const res = await createCurriculumTopicTool(ctx({ teacherId: "t2" }), {
      studentId: "s1",
      title: "X",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("FORBIDDEN");
  });
});

describe("listCurriculumForStudentTool — rol kapsamı", () => {
  it("TEACHER kendi öğrencisinin konularını ve overallPercent görür", async () => {
    await createCurriculumTopicTool(ctx({ teacherId: "t1" }), {
      studentId: "s1",
      title: "A",
      progressPercent: 40,
    });
    await createCurriculumTopicTool(ctx({ teacherId: "t1" }), {
      studentId: "s1",
      title: "B",
      progressPercent: 80,
    });
    const res = await listCurriculumForStudentTool(ctx({ teacherId: "t1" }), { studentId: "s1" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.overallPercent).toBe(60);
    expect(res.data.topics).toHaveLength(2);
    expect(res.data.progressExplanation).toContain("aritmetik ortalama");
  });

  it("cross-teacher listeyi göremez", async () => {
    await createCurriculumTopicTool(ctx({ teacherId: "t1" }), {
      studentId: "s1",
      title: "A",
    });
    const res = await listCurriculumForStudentTool(ctx({ teacherId: "t2" }), { studentId: "s1" });
    expect(res.ok).toBe(false);
  });

  it("PARENT özet görür (history/notes detayı yok)", async () => {
    await createCurriculumTopicTool(ctx({ teacherId: "t1" }), {
      studentId: "s1",
      title: "Gam",
      notes: "gizli not",
      progressPercent: 30,
    });
    const res = await listCurriculumForStudentTool(
      ctx({ role: "PARENT", teacherId: undefined, studentId: "s1" }),
      { studentId: "s1" }
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.overallPercent).toBe(30);
    const topic = res.data.topics[0] as { title: string; notes?: string; history?: unknown };
    expect(topic.title).toBe("Gam");
    expect(topic.notes).toBeUndefined();
    expect(topic.history).toBeUndefined();
  });
});

describe("updateCurriculumTopicTool", () => {
  it("durum değişince varsayılan progress uygular ve history yazar", async () => {
    const created = await createCurriculumTopicTool(ctx({ teacherId: "t1" }), {
      studentId: "s1",
      title: "Etüt 1",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const updated = await updateCurriculumTopicTool(ctx({ teacherId: "t1" }), {
      topicId: created.data.topicId,
      status: "mastered",
      changeNote: "Sınav sonrası",
    });
    expect(updated.ok).toBe(true);
    const list = await listCurriculumForStudentTool(ctx({ teacherId: "t1" }), { studentId: "s1" });
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    const full = list.data.topics[0] as {
      progressPercent: number;
      status: string;
      history: { action: string; note?: string }[];
    };
    expect(full.status).toBe("mastered");
    expect(full.progressPercent).toBe(100);
    expect(full.history.some((h) => h.action === "status_changed" && h.note === "Sınav sonrası")).toBe(
      true
    );
  });

  it("başka öğretmen güncelleyemez", async () => {
    const created = await createCurriculumTopicTool(ctx({ teacherId: "t1" }), {
      studentId: "s1",
      title: "X",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const res = await updateCurriculumTopicTool(ctx({ teacherId: "t2" }), {
      topicId: created.data.topicId,
      status: "in_progress",
    });
    expect(res.ok).toBe(false);
  });
});
