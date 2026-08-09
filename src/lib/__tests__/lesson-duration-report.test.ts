import { describe, expect, it } from "vitest";
import { computeLessonDurationRow } from "../lesson-duration-report";

describe("computeLessonDurationRow", () => {
  it("planlanan süreyi startAt/endAt'tan türetir", () => {
    const row = computeLessonDurationRow({
      id: "l1",
      startAt: "2026-08-10T10:00:00.000Z",
      endAt: "2026-08-10T10:40:00.000Z",
    });
    expect(row.plannedMinutes).toBe(40);
    expect(row.actualMinutes).toBeUndefined();
    expect(row.diffMinutes).toBeUndefined();
  });

  it("actualStartAt/actualEndAt varsa gerçekleşen süre ve farkı hesaplar", () => {
    const row = computeLessonDurationRow({
      id: "l2",
      startAt: "2026-08-10T10:00:00.000Z",
      endAt: "2026-08-10T10:40:00.000Z",
      actualStartAt: "2026-08-10T10:05:00.000Z",
      actualEndAt: "2026-08-10T10:50:00.000Z",
    });
    expect(row.plannedMinutes).toBe(40);
    expect(row.actualMinutes).toBe(45);
    expect(row.diffMinutes).toBe(5);
  });

  it("kısa kesilen ders için negatif fark döner", () => {
    const row = computeLessonDurationRow({
      id: "l3",
      startAt: "2026-08-10T10:00:00.000Z",
      endAt: "2026-08-10T10:40:00.000Z",
      actualStartAt: "2026-08-10T10:00:00.000Z",
      actualEndAt: "2026-08-10T10:30:00.000Z",
    });
    expect(row.diffMinutes).toBe(-10);
  });

  it("yalnız actualStartAt varsa (ders hâlâ devam ediyor) actualMinutes undefined kalır", () => {
    const row = computeLessonDurationRow({
      id: "l4",
      startAt: "2026-08-10T10:00:00.000Z",
      endAt: "2026-08-10T10:40:00.000Z",
      actualStartAt: "2026-08-10T10:05:00.000Z",
    });
    expect(row.actualMinutes).toBeUndefined();
    expect(row.diffMinutes).toBeUndefined();
  });
});
