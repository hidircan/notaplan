import { describe, it, expect, beforeEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { resolveDataDir } from "../config";
import {
  addLessonSeries,
  cancelLessonSeriesFromLesson,
  cancelEntireLessonSeries,
  readData,
} from "../store";
import type { SeriesParams } from "../lesson-series";

const DATA_FILE = path.join(resolveDataDir(path.join(process.cwd(), "data")), "store.json");

beforeEach(async () => {
  await fs.rm(DATA_FILE, { force: true });
});

const baseParams: SeriesParams = {
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

describe("addLessonSeries (store)", () => {
  it("çakışma yoksa seriyi ve tüm dersleri atomik olarak yazar", async () => {
    const result = await addLessonSeries(baseParams);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.createdLessonIds).toHaveLength(3);

    const data = await readData();
    expect(data.lessonSeries.some((s) => s.id === result.seriesId)).toBe(true);
    for (const id of result.createdLessonIds) {
      expect(data.lessons.some((l) => l.id === id && l.seriesId === result.seriesId)).toBe(true);
    }
  });

  it("var olmayan öğretmen id'si reddedilir, hiçbir şey yazılmaz", async () => {
    const before = await readData();
    await expect(addLessonSeries({ ...baseParams, teacherId: "does-not-exist" })).rejects.toThrow();
    const after = await readData();
    expect(after.lessonSeries.length).toBe(before.lessonSeries.length);
    expect(after.lessons.length).toBe(before.lessons.length);
  });

  it("tenant dışı/bulunamayan şube reddedilir", async () => {
    await expect(addLessonSeries({ ...baseParams, branchId: "does-not-exist" })).rejects.toThrow();
  });
});

describe("cancelLessonSeriesFromLesson (store)", () => {
  it("bu ders ve sonrasını iptal eder, önceki dersleri korur", async () => {
    const created = await addLessonSeries(baseParams);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const secondLessonId = created.createdLessonIds[1];
    const result = await cancelLessonSeriesFromLesson(secondLessonId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const data = await readData();
    const first = data.lessons.find((l) => l.id === created.createdLessonIds[0])!;
    const second = data.lessons.find((l) => l.id === secondLessonId)!;
    expect(first.status).toBe("scheduled");
    expect(second.status).toBe("cancelled");

    const series = data.lessonSeries.find((s) => s.id === created.seriesId)!;
    expect(series.status).toBe("ended");
  });
});

describe("cancelEntireLessonSeries (store)", () => {
  it("tüm seriyi iptal eder", async () => {
    const created = await addLessonSeries(baseParams);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await cancelEntireLessonSeries(created.seriesId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const data = await readData();
    const series = data.lessonSeries.find((s) => s.id === created.seriesId)!;
    expect(series.status).toBe("cancelled");
    for (const id of created.createdLessonIds) {
      expect(data.lessons.find((l) => l.id === id)!.status).toBe("cancelled");
    }
  });
});
