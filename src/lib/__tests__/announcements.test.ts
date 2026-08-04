import { describe, it, expect, beforeEach } from "vitest";
import { promises as fs } from "fs";
import {
  createAnnouncementTool,
  listAllAnnouncementsTool,
  listAnnouncementsForUserTool,
  markAnnouncementReadTool,
  listAnnouncementReadersTool,
  updateAnnouncementStatusTool,
} from "../services/tools";
import { readData } from "../store";
import {
  ANNOUNCEMENTS_FILE,
  ANNOUNCEMENT_READS_FILE,
  clearAnnouncements,
} from "../announcements";
import { DEFAULT_TENANT_ID } from "../auth/config";
import type { ServiceContext } from "../services/context";

function ctx(overrides?: Partial<ServiceContext>): ServiceContext {
  return {
    role: "SCHOOL_ADMIN",
    userId: "admin1",
    tenantId: DEFAULT_TENANT_ID,
    channel: "web",
    ...overrides,
  };
}

beforeEach(async () => {
  await fs.rm(ANNOUNCEMENTS_FILE, { force: true });
  await fs.rm(ANNOUNCEMENT_READS_FILE, { force: true });
  await clearAnnouncements(DEFAULT_TENANT_ID);
});

describe("EPIC 5 — createAnnouncementTool / RBAC", () => {
  it("TEACHER duyuru oluşturamaz (FORBIDDEN)", async () => {
    const result = await createAnnouncementTool(ctx({ role: "TEACHER", teacherId: "t1" }), {
      title: "x",
      body: "y",
      audienceType: "all",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
  });

  it("SCHOOL_ADMIN taslak duyuru oluşturabilir; varsayılan status draft", async () => {
    const created = await createAnnouncementTool(ctx(), {
      title: "Yeni dönem başlıyor",
      body: "Detaylar için okulla iletişime geçin.",
      audienceType: "all",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const all = await listAllAnnouncementsTool(ctx());
    expect(all.ok).toBe(true);
    if (!all.ok) return;
    const found = all.data.announcements.find((a) => a.id === created.data.announcementId);
    expect(found?.status).toBe("draft");
  });

  it("branch hedefi audienceRef olmadan reddedilir (VALIDATION_ERROR)", async () => {
    const result = await createAnnouncementTool(ctx(), {
      title: "x",
      body: "y",
      audienceType: "branch",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("EPIC 5 — listAnnouncementsForUserTool (portal görünümü, hedef kitle filtresi)", () => {
  it("draft duyuru hiçbir portale sızmaz", async () => {
    const created = await createAnnouncementTool(ctx(), {
      title: "Taslak",
      body: "y",
      audienceType: "all",
      status: "draft",
    });
    expect(created.ok).toBe(true);

    const data = await readData();
    const student = data.students[0];
    const result = await listAnnouncementsForUserTool(
      ctx({ role: "PARENT", userId: "parent1", studentId: student.id })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.announcements).toHaveLength(0);
  });

  it("published + all: veli ve öğretmen görür", async () => {
    await createAnnouncementTool(ctx(), {
      title: "Genel duyuru",
      body: "y",
      audienceType: "all",
      status: "published",
    });

    const data = await readData();
    const student = data.students[0];
    const teacher = data.teachers[0];

    const parentView = await listAnnouncementsForUserTool(
      ctx({ role: "PARENT", userId: "parent1", studentId: student.id })
    );
    expect(parentView.ok).toBe(true);
    if (parentView.ok) expect(parentView.data.announcements).toHaveLength(1);

    const teacherView = await listAnnouncementsForUserTool(
      ctx({ role: "TEACHER", userId: "teacher1", teacherId: teacher.id })
    );
    expect(teacherView.ok).toBe(true);
    if (teacherView.ok) expect(teacherView.data.announcements).toHaveLength(1);
  });

  it("branch hedefli published duyuru: başka şubedeki veli görmez", async () => {
    const data = await readData();
    const erzeneStudent = data.students.find((s) => s.branchId === "erzene");
    const evka3Student = data.students.find((s) => s.branchId === "evka3");
    expect(erzeneStudent).toBeDefined();
    expect(evka3Student).toBeDefined();
    if (!erzeneStudent || !evka3Student) return;

    await createAnnouncementTool(ctx(), {
      title: "Erzene şube duyurusu",
      body: "y",
      audienceType: "branch",
      audienceRef: { branchId: "erzene" },
      status: "published",
    });

    const inBranch = await listAnnouncementsForUserTool(
      ctx({ role: "PARENT", userId: "p1", studentId: erzeneStudent.id })
    );
    expect(inBranch.ok).toBe(true);
    if (inBranch.ok) expect(inBranch.data.announcements).toHaveLength(1);

    const outOfBranch = await listAnnouncementsForUserTool(
      ctx({ role: "PARENT", userId: "p2", studentId: evka3Student.id })
    );
    expect(outOfBranch.ok).toBe(true);
    if (outOfBranch.ok) expect(outOfBranch.data.announcements).toHaveLength(0);
  });

  it("expireAt geçmişteyse artık listede görünmez", async () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    await createAnnouncementTool(ctx(), {
      title: "Süresi dolan",
      body: "y",
      audienceType: "all",
      status: "published",
      expireAt: past,
    });
    const data = await readData();
    const result = await listAnnouncementsForUserTool(
      ctx({ role: "PARENT", userId: "p1", studentId: data.students[0].id })
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.announcements).toHaveLength(0);
  });
});

describe("EPIC 5 — markAnnouncementReadTool / listAnnouncementReadersTool", () => {
  it("okundu işaretleme idempotenttir ve yönetim ekranında görünür", async () => {
    const created = await createAnnouncementTool(ctx(), {
      title: "x",
      body: "y",
      audienceType: "all",
      status: "published",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await markAnnouncementReadTool(ctx({ role: "PARENT", userId: "parent-x" }), {
      announcementId: created.data.announcementId,
    });
    await markAnnouncementReadTool(ctx({ role: "PARENT", userId: "parent-x" }), {
      announcementId: created.data.announcementId,
    });

    const readers = await listAnnouncementReadersTool(ctx(), {
      announcementId: created.data.announcementId,
    });
    expect(readers.ok).toBe(true);
    if (!readers.ok) return;
    expect(readers.data.userIds).toEqual(["parent-x"]);
  });

  it("TEACHER kim-okudu tablosunu göremez (FORBIDDEN)", async () => {
    const created = await createAnnouncementTool(ctx(), {
      title: "x",
      body: "y",
      audienceType: "all",
      status: "published",
    });
    if (!created.ok) return;
    const result = await listAnnouncementReadersTool(ctx({ role: "TEACHER", teacherId: "t1" }), {
      announcementId: created.data.announcementId,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
  });
});

describe("EPIC 5 — updateAnnouncementStatusTool", () => {
  it("draft -> published sonrası portale çıkar", async () => {
    const created = await createAnnouncementTool(ctx(), {
      title: "x",
      body: "y",
      audienceType: "all",
    });
    if (!created.ok) return;

    const data = await readData();
    const before = await listAnnouncementsForUserTool(
      ctx({ role: "PARENT", userId: "p1", studentId: data.students[0].id })
    );
    if (before.ok) expect(before.data.announcements).toHaveLength(0);

    const updated = await updateAnnouncementStatusTool(ctx(), {
      announcementId: created.data.announcementId,
      status: "published",
    });
    expect(updated.ok).toBe(true);

    const after = await listAnnouncementsForUserTool(
      ctx({ role: "PARENT", userId: "p1", studentId: data.students[0].id })
    );
    if (after.ok) expect(after.data.announcements).toHaveLength(1);
  });

  it("var olmayan duyuru id'si NOT_FOUND döner", async () => {
    const result = await updateAnnouncementStatusTool(ctx(), {
      announcementId: "does-not-exist",
      status: "archived",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
  });
});
