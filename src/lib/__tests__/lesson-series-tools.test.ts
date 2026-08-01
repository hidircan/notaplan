import { describe, it, expect, beforeEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { resolveDataDir } from "../config";
import {
  previewLessonSeriesTool,
  createLessonSeriesTool,
  cancelSeriesFromLessonTool,
  cancelEntireSeriesTool,
} from "../services/tools";
import { readData } from "../store";
import { DEFAULT_TENANT_ID } from "../auth/config";
import type { ServiceContext } from "../services/context";

const DATA_FILE = path.join(resolveDataDir(path.join(process.cwd(), "data")), "store.json");

function ctx(overrides?: Partial<ServiceContext>): ServiceContext {
  return {
    role: "SCHOOL_ADMIN",
    userId: "u1",
    tenantId: DEFAULT_TENANT_ID,
    channel: "web",
    ...overrides,
  };
}

beforeEach(async () => {
  await fs.rm(DATA_FILE, { force: true });
});

const baseInput = {
  studentId: "s1",
  teacherId: "t1",
  roomId: "r1",
  branchId: "erzene",
  instrument: "Piyano",
  weekday: 2,
  startTime: "11:00",
  durationMinutes: 45,
  startsOn: "2026-09-01",
  endsOn: "2026-09-15",
};

describe("previewLessonSeriesTool", () => {
  it("hiçbir kayıt yazmadan Türkçe önizleme ve oluşum sayısını döner", async () => {
    const before = await readData();
    const res = await previewLessonSeriesTool(ctx(), baseInput);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.occurrenceCount).toBe(3);
    expect(res.data.conflictCount).toBe(0);
    expect(res.data.previewText).toContain("Zeynep Arslan");
    expect(res.data.previewText).toContain("3 ders oluşturulacak");

    const after = await readData();
    expect(after.lessonSeries.length).toBe(before.lessonSeries.length);
    expect(after.lessons.length).toBe(before.lessons.length);
  });

  it("var olmayan öğrenci için NOT_FOUND döner", async () => {
    const res = await previewLessonSeriesTool(ctx(), { ...baseInput, studentId: "does-not-exist" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("NOT_FOUND");
  });

  it("veli/öğretmen rolü önizleme dahi yapamaz (FORBIDDEN)", async () => {
    const res = await previewLessonSeriesTool(ctx({ role: "TEACHER" }), baseInput);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("FORBIDDEN");
  });
});

describe("createLessonSeriesTool", () => {
  it("çakışma yoksa tüm dersleri oluşturur", async () => {
    const res = await createLessonSeriesTool(ctx(), baseInput);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.createdLessonIds).toHaveLength(3);

    const data = await readData();
    expect(data.lessonSeries.some((s) => s.id === res.data.seriesId)).toBe(true);
  });

  it("varsayılan davranışta çakışma varsa CONFLICT döner, hiçbir kayıt yazılmaz", async () => {
    const data0 = await readData();
    const l14 = data0.lessons.find((l) => l.id === "l14")!;
    const conflictInput = {
      ...baseInput,
      studentId: "s3",
      teacherId: l14.teacherId,
      roomId: l14.roomId,
      weekday: new Date(l14.startAt).getDay(),
      startTime: `${new Date(l14.startAt).getHours()}:00`,
      startsOn: l14.startAt.slice(0, 10),
      endsOn: l14.startAt.slice(0, 10),
    };
    const before = await readData();
    const res = await createLessonSeriesTool(ctx(), conflictInput);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("CONFLICT");
      expect(Array.isArray(res.error.details)).toBe(true);
    }
    const after = await readData();
    expect(after.lessons.length).toBe(before.lessons.length);
    expect(after.lessonSeries.length).toBe(before.lessonSeries.length);
  });

  it("skipConflicts=true ile yalnızca çakışmayanlar oluşur", async () => {
    const data0 = await readData();
    const l14 = data0.lessons.find((l) => l.id === "l14")!;
    const conflictDate = l14.startAt.slice(0, 10);
    const input = {
      ...baseInput,
      studentId: "s3",
      teacherId: l14.teacherId,
      roomId: l14.roomId,
      weekday: new Date(l14.startAt).getDay(),
      startTime: `${new Date(l14.startAt).getHours()}:00`,
      startsOn: new Date(new Date(conflictDate).getTime() - 7 * 86400000).toISOString().slice(0, 10),
      endsOn: new Date(new Date(conflictDate).getTime() + 7 * 86400000).toISOString().slice(0, 10),
      skipConflicts: true,
    };
    const res = await createLessonSeriesTool(ctx(), input);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.createdLessonIds.length).toBeGreaterThan(0);
    expect(res.data.skippedOccurrences.length).toBeGreaterThan(0);
  });

  it("veli rolü seri oluşturamaz (FORBIDDEN)", async () => {
    const res = await createLessonSeriesTool(ctx({ role: "PARENT" }), baseInput);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("FORBIDDEN");
  });
});

describe("cancelSeriesFromLessonTool / cancelEntireSeriesTool", () => {
  it("'bu ders ve sonrası' geçmiş dersi korur, kalanları iptal eder", async () => {
    const created = await createLessonSeriesTool(ctx(), baseInput);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const secondId = created.data.createdLessonIds[1];
    const res = await cancelSeriesFromLessonTool(ctx(), { lessonId: secondId });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.cancelledLessonIds).toContain(secondId);

    const data = await readData();
    const first = data.lessons.find((l) => l.id === created.data.createdLessonIds[0])!;
    expect(first.status).toBe("scheduled");
  });

  it("'tüm seri' iptali tüm gelecekteki dersleri kapatır", async () => {
    const created = await createLessonSeriesTool(ctx(), baseInput);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const res = await cancelEntireSeriesTool(ctx(), { seriesId: created.data.seriesId });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.cancelledLessonIds.length).toBe(created.data.createdLessonIds.length);

    const data = await readData();
    const series = data.lessonSeries.find((s) => s.id === created.data.seriesId)!;
    expect(series.status).toBe("cancelled");
  });

  it("öğretmen rolü seri iptal edemez (FORBIDDEN)", async () => {
    const created = await createLessonSeriesTool(ctx(), baseInput);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const res = await cancelEntireSeriesTool(ctx({ role: "TEACHER" }), { seriesId: created.data.seriesId });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("FORBIDDEN");
  });
});
