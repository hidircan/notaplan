import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildDemoMessages } from "../whatsapp-templates";
import type { AppData } from "../types";

const ORIGINAL_TZ = process.env.TZ;

function buildFixture(): AppData {
  return {
    settings: {
      tenantId: "tenant_test",
      name: "Test Akademi",
      shortName: "Test",
      city: "İzmir",
      website: "",
      email: "",
      phone: "",
      logoUrl: "",
      makeupWindowDays: 14,
      lessonDurationMinutes: 45,
      workingHours: { start: "00:00", end: "23:59" },
      workingDays: [0, 1, 2, 3, 4, 5, 6],
      currency: "TRY",
      branches: [
        { id: "erzene", name: "Erzene", shortName: "Erzene", address: "", phone: "", city: "İzmir" },
      ],
    },
    teachers: [
      {
        id: "t1",
        name: "Nilüfer",
        email: "",
        phone: "",
        branchId: "erzene",
        instruments: ["Piyano"],
        availability: [],
        maxDailyLessons: 8,
        active: true,
        color: "#000",
      },
    ],
    students: [
      {
        id: "s1",
        name: "Zeynep",
        email: "",
        phone: "",
        parentName: "Veli Z",
        parentPhone: "05551112233",
        branchId: "erzene",
        instruments: ["Piyano"],
        teacherId: "t1",
        packageName: "Bireysel Aylık",
        weeklyLessonCount: 1,
        monthlyFee: 3000,
        active: true,
        notes: "",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    rooms: [{ id: "r1", name: "Stüdyo 1", branchId: "erzene", capacity: 2, instruments: ["Piyano"] }],
    lessons: [],
    lessonSeries: [],
    attendances: [],
    makeupRequests: [],
    payments: [],
  };
}

describe("whatsapp-templates · buildDemoMessages devamsızlık bildirimi (yerel gün)", () => {
  beforeEach(() => {
    // App Türkiye (UTC+3) için çalışıyor; yerel gün hesabı bu saat dilimine göre doğrulanır.
    process.env.TZ = "Europe/Istanbul";
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env.TZ = ORIGINAL_TZ;
  });

  it("yerel günün erken saatlerindeki (00:00-02:59) dersi UTC gün kaymasına rağmen bugün sayar", () => {
    // "Şimdi": yerel 5 Ağustos 10:00 (UTC 5 Ağustos 07:00)
    vi.setSystemTime(new Date("2026-08-05T07:00:00.000Z"));
    // Ders: yerel 5 Ağustos 01:00 (UTC 4 Ağustos 22:00) — UTC tarihi "bugün"den farklı,
    // ama yerel takvim günü aynı. Eski `.toISOString().slice(0,10)` karşılaştırması
    // bu dersi "dün" sanıp mesajı üretmezdi.
    const lessonStart = "2026-08-04T22:00:00.000Z";

    const data = buildFixture();
    data.lessons.push({
      id: "l1",
      studentId: "s1",
      teacherId: "t1",
      roomId: "r1",
      branchId: "erzene",
      instrument: "Piyano",
      startAt: lessonStart,
      endAt: lessonStart,
      type: "regular",
      status: "no_show",
    });
    data.attendances.push({
      id: "a1",
      lessonId: "l1",
      studentId: "s1",
      status: "absent",
      reason: "Veli bildirdi — mazeret",
      markedAt: lessonStart,
      createsMakeupCredit: true,
    });

    const msgs = buildDemoMessages(data);
    expect(msgs.some((m) => m.title === "Devamsızlık bildirimi")).toBe(true);
  });

  it("dünün (farklı yerel gün) devamsızlığını bugün listelemez", () => {
    // "Şimdi": yerel 5 Ağustos 10:00
    vi.setSystemTime(new Date("2026-08-05T07:00:00.000Z"));
    // Ders: yerel 4 Ağustos 20:00 — gerçekten dün, farklı yerel gün.
    const lessonStart = "2026-08-04T17:00:00.000Z";

    const data = buildFixture();
    data.lessons.push({
      id: "l1",
      studentId: "s1",
      teacherId: "t1",
      roomId: "r1",
      branchId: "erzene",
      instrument: "Piyano",
      startAt: lessonStart,
      endAt: lessonStart,
      type: "regular",
      status: "no_show",
    });
    data.attendances.push({
      id: "a1",
      lessonId: "l1",
      studentId: "s1",
      status: "absent",
      reason: "Veli bildirdi — mazeret",
      markedAt: lessonStart,
      createsMakeupCredit: true,
    });

    const msgs = buildDemoMessages(data);
    expect(msgs.some((m) => m.title === "Devamsızlık bildirimi")).toBe(false);
  });

  it("yarının erken saatlerindeki (00:00-02:59) planlı dersi UTC gün kaymasına rağmen hatırlatır", () => {
    // "Şimdi": yerel 5 Ağustos 10:00
    vi.setSystemTime(new Date("2026-08-05T07:00:00.000Z"));
    // Ders: yerel 6 Ağustos 01:00 (UTC 5 Ağustos 22:00) — UTC tarihi "yarın"dan farklı,
    // ama yerel takvim günü aynı. Eski `.toISOString().slice(0,10)` karşılaştırması
    // bu dersi "yarın değil" sanıp hatırlatmayı üretmezdi.
    const lessonStart = "2026-08-05T22:00:00.000Z";

    const data = buildFixture();
    data.lessons.push({
      id: "l1",
      studentId: "s1",
      teacherId: "t1",
      roomId: "r1",
      branchId: "erzene",
      instrument: "Piyano",
      startAt: lessonStart,
      endAt: lessonStart,
      type: "regular",
      status: "scheduled",
    });

    const msgs = buildDemoMessages(data);
    expect(msgs.some((m) => m.title === "Ders hatırlatması")).toBe(true);
  });
});
