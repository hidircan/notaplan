import { describe, it, expect } from "vitest";
import { createSeedData } from "../seed";
import { buildLessonCommunicationDraft } from "../whatsapp-templates";
import type { Lesson } from "../types";

function makeLesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: "l_test",
    studentId: "s1",
    teacherId: "t1",
    roomId: "r1",
    branchId: "erzene",
    instrument: "Piyano",
    startAt: "2026-08-10T11:00:00.000Z",
    endAt: "2026-08-10T11:45:00.000Z",
    type: "regular",
    status: "scheduled",
    ...overrides,
  };
}

describe("buildLessonCommunicationDraft", () => {
  const data = createSeedData();
  const student = data.students.find((s) => s.id === "s1")!;
  const teacher = data.teachers.find((t) => t.id === "t1")!;

  it("veli ve öğretmen taslağı doğru kişi, tarih/saat ve ders bilgisiyle üretilir", () => {
    const lesson = makeLesson();
    const draft = buildLessonCommunicationDraft(data.settings.name, student, teacher, lesson, "Erzene");

    expect(draft.parent.audience).toBe("veli");
    expect(draft.parent.toName).toBe(student.parentName);
    expect(draft.parent.toPhone).toBe(student.parentPhone);
    expect(draft.parent.body).toContain(student.name);
    expect(draft.parent.body).toContain(teacher.name);
    expect(draft.parent.body).toContain(lesson.instrument);
    expect(draft.parent.body).toContain("Erzene");
    expect(draft.parent.waLink).not.toBeNull();
    expect(draft.parent.waLink).toContain(encodeURIComponent(student.name));

    expect(draft.teacher.audience).toBe("öğretmen");
    expect(draft.teacher.toName).toBe(teacher.name);
    expect(draft.teacher.body).toContain(student.name);
    expect(draft.teacher.body).toContain(lesson.instrument);
    expect(draft.teacher.waLink).not.toBeNull();
  });

  it("telefon kayıtlı değilse bozuk wa.me linki üretilmez, eksik bilgi açıkça işaretlenir", () => {
    const studentNoPhone = { ...student, parentPhone: "" };
    const lesson = makeLesson();
    const draft = buildLessonCommunicationDraft(data.settings.name, studentNoPhone, teacher, lesson, "Erzene");

    expect(draft.parent.waLink).toBeNull();
    expect(draft.parent.missingPhoneReason).toBeTruthy();
    // Öğretmen telefonu mevcut — o taslak etkilenmemeli
    expect(draft.teacher.waLink).not.toBeNull();
  });

  it("taslak üretimi saf ve yan etkisizdir — aynı girdi için deterministik sonuç verir, gönderim durumu izlemez", () => {
    const lesson = makeLesson();
    const first = buildLessonCommunicationDraft(data.settings.name, student, teacher, lesson, "Erzene");
    const second = buildLessonCommunicationDraft(data.settings.name, student, teacher, lesson, "Erzene");
    expect(first).toEqual(second);

    // Taslak nesnesi hiçbir kalıcı "gönderildi" durumu alanı içermez —
    // "sistemde gönderildi" işareti sadece UI'da geçici/istemci taraflı olabilir.
    expect(Object.keys(first.parent).sort()).toEqual(
      ["audience", "body", "toName", "toPhone", "waLink"].sort()
    );
    expect(Object.keys(first.teacher).sort()).toEqual(
      ["audience", "body", "toName", "toPhone", "waLink"].sort()
    );
  });
});
