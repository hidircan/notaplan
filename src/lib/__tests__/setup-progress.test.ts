import { describe, it, expect } from "vitest";
import { addDays } from "date-fns";
import { computeSetupProgress } from "../setup-progress";
import { createSeedData } from "../seed";
import type { AppData } from "../types";

const NOW = new Date();

function emptyData(): AppData {
  return {
    settings: {
      tenantId: "tenant_test",
      name: "Yeni Okul",
      shortName: "Yeni Okul",
      city: "",
      website: "",
      email: "",
      phone: "",
      logoUrl: "",
      makeupWindowDays: 14,
      lessonDurationMinutes: 45,
      workingHours: { start: "09:00", end: "18:00" },
      workingDays: [1, 2, 3, 4, 5],
      currency: "TRY",
      branches: [],
    },
    teachers: [],
    students: [],
    rooms: [],
    lessons: [],
    attendances: [],
    makeupRequests: [],
    payments: [],
  };
}

function readyData(): AppData {
  const data = emptyData();
  data.settings.branches = [
    { id: "erzene", name: "Erzene", shortName: "Erzene", address: "", phone: "", city: "İzmir" },
  ];
  data.teachers = [
    {
      id: "t1",
      name: "Öğretmen",
      email: "",
      phone: "",
      branchId: "erzene",
      instruments: ["Piyano"],
      availability: [{ dayOfWeek: 1, start: "09:00", end: "18:00" }],
      maxDailyLessons: 8,
      active: true,
      color: "#000",
    },
  ];
  data.rooms = [
    { id: "r1", name: "Stüdyo 1", branchId: "erzene", capacity: 2, instruments: ["Piyano"] },
  ];
  data.students = [
    {
      id: "s1",
      name: "Öğrenci",
      email: "",
      phone: "",
      parentName: "Veli",
      parentPhone: "",
      branchId: "erzene",
      instruments: ["Piyano"],
      teacherId: "t1",
      packageName: "Bireysel Aylık",
      weeklyLessonCount: 1,
      monthlyFee: 3000,
      active: true,
      notes: "",
      createdAt: NOW.toISOString(),
    },
  ];
  data.lessons = [
    {
      id: "l1",
      studentId: "s1",
      teacherId: "t1",
      roomId: "r1",
      branchId: "erzene",
      instrument: "Piyano",
      startAt: addDays(NOW, 1).toISOString(),
      endAt: addDays(NOW, 1).toISOString(),
      type: "regular",
      status: "scheduled",
    },
  ];
  return data;
}

describe("setup-progress · computeSetupProgress", () => {
  it("boş/minimum tenantta adımlar eksik görünür", () => {
    const progress = computeSetupProgress(emptyData(), NOW);
    expect(progress.completedCount).toBe(0);
    expect(progress.isReady).toBe(false);
    expect(progress.steps.every((s) => !s.done)).toBe(true);
  });

  it("minimum hazır veriyle 5 temel adım tamamlanır", () => {
    const progress = computeSetupProgress(readyData(), NOW);
    expect(progress.completedCount).toBe(5);
    expect(progress.totalCount).toBe(5);
    expect(progress.isReady).toBe(true);
  });

  it("ödeme kaydı yokken temel kurulum yine hazır kabul edilir", () => {
    const data = readyData();
    expect(data.payments).toHaveLength(0);
    const progress = computeSetupProgress(data, NOW);
    expect(progress.isReady).toBe(true);
    expect(progress.hasPayment).toBe(false);
  });

  it("gelecekteki scheduled ders yoksa son temel ders adımı eksik kalır", () => {
    const data = readyData();
    data.lessons = [];
    const progress = computeSetupProgress(data, NOW);
    expect(progress.steps.find((s) => s.id === "firstLesson")?.done).toBe(false);
    expect(progress.isReady).toBe(false);
    expect(progress.completedCount).toBe(4);
  });

  it("pasif öğretmen/öğrenci veya iptal edilmiş ders kurulum tamamlanmasına yanlış katkı sağlamaz", () => {
    const data = readyData();
    data.teachers[0].active = false;
    data.students[0].active = false;
    data.lessons[0].status = "cancelled";

    const progress = computeSetupProgress(data, NOW);
    expect(progress.steps.find((s) => s.id === "teachers")?.done).toBe(false);
    expect(progress.steps.find((s) => s.id === "students")?.done).toBe(false);
    expect(progress.steps.find((s) => s.id === "firstLesson")?.done).toBe(false);
    expect(progress.isReady).toBe(false);
    // Şube ve oda hâlâ mevcut olduğu için yalnızca bu ikisi tamamlanmış sayılmalı.
    expect(progress.completedCount).toBe(2);
  });

  it("mevcut demo seed verisi temel kurulum tamamlandı sonucunu verir", () => {
    const seed = createSeedData();
    const progress = computeSetupProgress(seed);
    expect(progress.isReady).toBe(true);
    expect(progress.completedCount).toBe(5);
  });
});
