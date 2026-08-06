import { describe, it, expect, beforeEach } from "vitest";
import { promises as fs } from "fs";
import { createSeedData } from "../seed";
import {
  buildInstitutionExport,
  EXPORT_ENTITIES,
  type StandaloneExportData,
} from "../export/institution-export";
import { createNotification, listAllNotifications, NOTIFICATIONS_FILE } from "../notifications";
import { createAnnouncement, listAnnouncements, ANNOUNCEMENTS_FILE } from "../announcements";
import { createAssessment, listAllAssessments, LESSON_ASSESSMENTS_FILE } from "../assessment";
import {
  createAvailabilityRequest,
  listAllAvailabilityRequests,
  TEACHER_AVAILABILITY_REQUESTS_FILE,
} from "../teacher-availability";
import {
  createHomework,
  listAllHomework,
  HOMEWORK_FILE_PATH,
  HOMEWORK_SUBMISSIONS_FILE_PATH,
} from "../homework";
import { createTeachingMaterial, listTeachingMaterials, TEACHING_MATERIALS_FILE_PATH } from "../teaching-materials";
import { submitTeacherFeedback, listTeacherFeedback, TEACHER_FEEDBACK_FILE_PATH } from "../teacher-feedback";

const data = createSeedData();

const VALID_SCORES = {
  teknikBecerisi: 5,
  notaOkuma: 4,
  muzikalite: 4,
  ritimDuyusu: 3,
  calismaDuzeni: 3,
  evOdeviTamamlama: 3,
  dersKatilimi: 4,
  motivasyon: 5,
  genelIlerleme: 4,
  hedefeUlasma: 4,
};

function fullExtraFixture(): StandaloneExportData {
  return {
    notifications: [
      {
        id: "n1",
        targetUserId: "u1",
        kind: "payment_overdue",
        title: "Gecikmiş ödeme",
        body: "Ödeme gecikti",
        createdAt: new Date().toISOString(),
      },
    ],
    announcements: [
      {
        id: "ann1",
        title: "Tatil duyurusu",
        body: "Okul kapalı",
        audienceType: "all",
        status: "published",
        pinned: false,
        createdBy: "admin1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    lessonAssessments: [
      {
        id: "la1",
        lessonId: "l1",
        studentId: "s1",
        teacherId: "t1",
        ...VALID_SCORES,
        strengthNote: "Ritim iyi",
        nextStepsNote: "Yeni parça",
        improvementNote: "Tempo",
        parentNoteVisibleToStudent: false,
        teacherSignedName: "Öğretmen",
        teacherSignedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    teacherAvailabilityRequests: [
      {
        id: "avreq1",
        teacherId: "t1",
        proposedAvailability: [{ dayOfWeek: 1, start: "09:00", end: "17:00" }],
        status: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    homework: [
      {
        id: "hw1",
        teacherId: "t1",
        studentId: "s1",
        title: "Gam çalışması",
        description: "Do majör",
        dueDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    homeworkSubmissions: [
      {
        id: "hwsub1",
        homeworkId: "hw1",
        studentId: "s1",
        submittedAt: new Date().toISOString(),
      },
    ],
    teachingMaterials: [
      {
        id: "mat1",
        teacherId: "t1",
        title: "Pratik videosu",
        description: "Gam çalışma",
        createdAt: new Date().toISOString(),
      },
    ],
    teacherFeedback: [
      {
        id: "tfb1",
        teacherId: "t1",
        studentId: "s1",
        submittedBy: "u1",
        submitterRole: "PARENT",
        scores: { clarity: 5, communication: 5, effectiveness: 5, motivation: 5, punctuality: 5 },
        updatedAt: new Date().toISOString(),
        status: "pending",
        sharedWithTeacher: false,
        createdAt: new Date().toISOString(),
      },
    ],
    studentCurriculumTopics: [
      {
        id: "cur1",
        studentId: "s1",
        teacherId: "t1",
        title: "Do majör gam",
        status: "in_progress",
        progressPercent: 50,
        sortOrder: 0,
        history: [],
        createdBy: "u1",
        updatedBy: "u1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  };
}

describe("buildInstitutionExport — yalnızca istenen varlıklar üretilir", () => {
  it("yalnızca 'students' istenirse yalnızca students CSV'si dolu döner", () => {
    const out = buildInstitutionExport(data, ["students"]);
    expect(out.students).toBeTruthy();
    expect(out.teachers).toBeUndefined();
    expect(out.payments).toBeUndefined();
  });

  it("tüm EXPORT_ENTITIES istenirse hepsi için CSV üretilir", () => {
    const out = buildInstitutionExport(data, EXPORT_ENTITIES, fullExtraFixture());
    for (const entity of EXPORT_ENTITIES) {
      expect(out[entity]).toBeTruthy();
      expect(out[entity].split("\r\n").length).toBeGreaterThan(1); // başlık + en az 1 satır
    }
  });

  it("standalone bir varlık istenip 'extra' verilmezse o varlık için CSV üretilmez", () => {
    const out = buildInstitutionExport(data, ["homework"]);
    expect(out.homework).toBeUndefined();
  });
});

describe("buildInstitutionExport — CSV doğruluğu", () => {
  it("students CSV'si başlık satırında beklenen sütunları içerir", () => {
    const out = buildInstitutionExport(data, ["students"]);
    const header = out.students.split("\r\n")[0];
    expect(header).toContain("ad");
    expect(header).toContain("veliAdi");
    expect(header).toContain("aylikUcret");
  });

  it("her öğrenci satırı gerçek veriden gelir — uydurma satır yok", () => {
    const out = buildInstitutionExport(data, ["students"]);
    const lines = out.students.split("\r\n").slice(1);
    expect(lines.length).toBe(data.students.length);
    expect(out.students).toContain(data.students[0].name);
  });

  it("virgül/tırnak içeren alanlar CSV-güvenli şekilde kaçırılır", () => {
    const withComma = {
      ...data,
      students: [{ ...data.students[0], notes: 'Not: "özel", dikkat' }],
    };
    const out = buildInstitutionExport(withComma, ["students"]);
    // Kaçırılmış hücre: çift tırnak içine alınmış, iç tırnaklar ikizlenmiş.
    expect(out.students).toContain('"Not: ""özel"", dikkat"');
  });

  it("payments CSV'sinde tutar/durum/vade alanları doğru satıra düşer", () => {
    const out = buildInstitutionExport(data, ["payments"]);
    const payment = data.payments[0];
    expect(out.payments).toContain(String(payment.amount));
    expect(out.payments).toContain(payment.status);
  });

  it("homeworkSubmissions CSV'si ham dosya içeriğini (base64) İÇERMEZ, yalnızca 'dosyaVarMi' bayrağı taşır", () => {
    const extra = fullExtraFixture();
    extra.homeworkSubmissions = [
      {
        id: "hwsub2",
        homeworkId: "hw1",
        studentId: "s1",
        fileName: "kayit.mp3",
        fileData: Buffer.from("fake-audio-content-that-should-not-leak").toString("base64"),
        submittedAt: new Date().toISOString(),
      },
    ];
    const out = buildInstitutionExport(data, ["homeworkSubmissions"], extra);
    expect(out.homeworkSubmissions).toContain("true");
    expect(out.homeworkSubmissions).not.toContain("fake-audio-content-that-should-not-leak");
  });

  it("teacherFeedback CSV'si puanları JSON olarak taşır", () => {
    const out = buildInstitutionExport(data, ["teacherFeedback"], fullExtraFixture());
    expect(out.teacherFeedback).toContain("clarity");
  });
});

describe("EPIC 0/12 — standalone export listeleri tenant'a kapalıdır (cross-tenant sızıntı yok)", () => {
  const TENANT_A = "tenant-export-a";
  const TENANT_B = "tenant-export-b";

  beforeEach(async () => {
    for (const f of [
      NOTIFICATIONS_FILE,
      ANNOUNCEMENTS_FILE,
      TEACHER_AVAILABILITY_REQUESTS_FILE,
      HOMEWORK_FILE_PATH,
      HOMEWORK_SUBMISSIONS_FILE_PATH,
      TEACHING_MATERIALS_FILE_PATH,
      TEACHER_FEEDBACK_FILE_PATH,
      LESSON_ASSESSMENTS_FILE,
    ]) {
      await fs.rm(f, { force: true });
    }
  });

  it("listAllNotifications yalnızca istenen tenant'ın kayıtlarını döner", async () => {
    await createNotification({
      tenantId: TENANT_A,
      targetUserId: "uA",
      kind: "payment_overdue",
      title: "A kurumu",
      body: "A",
    });
    await createNotification({
      tenantId: TENANT_B,
      targetUserId: "uB",
      kind: "payment_overdue",
      title: "B kurumu",
      body: "B",
    });
    const resultA = await listAllNotifications(TENANT_A);
    expect(resultA).toHaveLength(1);
    expect(resultA[0].title).toBe("A kurumu");
  });

  it("listAnnouncements yalnızca istenen tenant'ın kayıtlarını döner", async () => {
    await createAnnouncement({
      tenantId: TENANT_A,
      title: "A duyurusu",
      body: "A",
      audienceType: "all",
      createdBy: "admin",
    });
    await createAnnouncement({
      tenantId: TENANT_B,
      title: "B duyurusu",
      body: "B",
      audienceType: "all",
      createdBy: "admin",
    });
    const resultA = await listAnnouncements(TENANT_A);
    expect(resultA).toHaveLength(1);
    expect(resultA[0].title).toBe("A duyurusu");
  });

  it("listAllAssessments yalnızca istenen tenant'ın kayıtlarını döner", async () => {
    await createAssessment({
      tenantId: TENANT_A,
      lessonId: "lA",
      studentId: "sA",
      teacherId: "tA",
      ...VALID_SCORES,
      strengthNote: "A",
      nextStepsNote: "A",
      improvementNote: "A",
      parentNoteVisibleToStudent: false,
      teacherSignedName: "A",
    });
    await createAssessment({
      tenantId: TENANT_B,
      lessonId: "lB",
      studentId: "sB",
      teacherId: "tB",
      ...VALID_SCORES,
      strengthNote: "B",
      nextStepsNote: "B",
      improvementNote: "B",
      parentNoteVisibleToStudent: false,
      teacherSignedName: "B",
    });
    const resultA = await listAllAssessments(TENANT_A);
    expect(resultA).toHaveLength(1);
    expect(resultA[0].studentId).toBe("sA");
  });

  it("listAllAvailabilityRequests yalnızca istenen tenant'ın kayıtlarını döner", async () => {
    await createAvailabilityRequest({
      tenantId: TENANT_A,
      teacherId: "tA",
      proposedAvailability: [{ dayOfWeek: 1, start: "09:00", end: "17:00" }],
    });
    await createAvailabilityRequest({
      tenantId: TENANT_B,
      teacherId: "tB",
      proposedAvailability: [{ dayOfWeek: 2, start: "10:00", end: "18:00" }],
    });
    const resultA = await listAllAvailabilityRequests(TENANT_A);
    expect(resultA).toHaveLength(1);
    expect(resultA[0].teacherId).toBe("tA");
  });

  it("listAllHomework yalnızca istenen tenant'ın kayıtlarını döner", async () => {
    await createHomework({
      tenantId: TENANT_A,
      teacherId: "tA",
      studentId: "sA",
      title: "A ödevi",
      description: "A",
      dueDate: new Date().toISOString(),
    });
    await createHomework({
      tenantId: TENANT_B,
      teacherId: "tB",
      studentId: "sB",
      title: "B ödevi",
      description: "B",
      dueDate: new Date().toISOString(),
    });
    const resultA = await listAllHomework(TENANT_A);
    expect(resultA).toHaveLength(1);
    expect(resultA[0].title).toBe("A ödevi");
  });

  it("listTeachingMaterials yalnızca istenen tenant'ın kayıtlarını döner", async () => {
    await createTeachingMaterial({
      tenantId: TENANT_A,
      teacherId: "tA",
      title: "A materyali",
      description: "A",
    });
    await createTeachingMaterial({
      tenantId: TENANT_B,
      teacherId: "tB",
      title: "B materyali",
      description: "B",
    });
    const resultA = await listTeachingMaterials(TENANT_A);
    expect(resultA).toHaveLength(1);
    expect(resultA[0].title).toBe("A materyali");
  });

  it("listTeacherFeedback yalnızca istenen tenant'ın kayıtlarını döner", async () => {
    await submitTeacherFeedback({
      tenantId: TENANT_A,
      teacherId: "tA",
      studentId: "sA",
      submittedBy: "uA",
      submitterRole: "PARENT",
      scores: { clarity: 5, communication: 5, effectiveness: 5, motivation: 5, punctuality: 5 },
    });
    await submitTeacherFeedback({
      tenantId: TENANT_B,
      teacherId: "tB",
      studentId: "sB",
      submittedBy: "uB",
      submitterRole: "PARENT",
      scores: { clarity: 3, communication: 3, effectiveness: 3, motivation: 3, punctuality: 3 },
    });
    const resultA = await listTeacherFeedback(TENANT_A);
    expect(resultA).toHaveLength(1);
    expect(resultA[0].teacherId).toBe("tA");
  });
});
