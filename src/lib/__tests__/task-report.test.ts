import { describe, it, expect } from "vitest";
import { buildTaskReport, defaultTaskReportRange } from "../task-report";
import type { Task } from "../types";

function task(overrides: Partial<Task> & Pick<Task, "id">): Task {
  return {
    title: "Görev",
    status: "TODO",
    priority: "MEDIUM",
    category: "Kayıt",
    followerIds: [],
    createdById: "u1",
    progressPercent: 0,
    tags: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/**
 * İş Takip Faz 3B-3B — yönetici görev raporu saf agregasyon testleri.
 * `buildTaskReport` I/O yapmaz, tenant-scoped bir liste alır — burada
 * tenant/RBAC katmanının (tools.ts) ÜSTÜNDEKİ saf hesaplama mantığı
 * hedefli olarak doğrulanıyor.
 */
describe("buildTaskReport — açık iş yükü ve gecikme", () => {
  it("TODO/IN_PROGRESS/BLOCKED açık iş yüküne sayılır; COMPLETED/CANCELLED/ARCHIVED sayılmaz", () => {
    const tasks = [
      task({ id: "t1", status: "TODO" }),
      task({ id: "t2", status: "IN_PROGRESS" }),
      task({ id: "t3", status: "BLOCKED" }),
      task({ id: "t4", status: "COMPLETED" }),
      task({ id: "t5", status: "CANCELLED" }),
      task({ id: "t6", status: "ARCHIVED" }),
    ];
    const report = buildTaskReport(tasks, { startYmd: "2026-01-01", endYmd: "2026-01-31" }, "2026-01-15");
    expect(report.openWorkload).toEqual({ todo: 1, inProgress: 1, blocked: 1, total: 3 });
  });

  it("gecikmiş hesaplama tamamlanan/iptal/arşiv görevleri dışlar", () => {
    const tasks = [
      task({ id: "t1", status: "TODO", dueDate: "2026-01-01" }), // gecikmiş
      task({ id: "t2", status: "COMPLETED", dueDate: "2026-01-01", completedAt: "2026-01-02" }), // gecikmiş sayılmaz
      task({ id: "t3", status: "CANCELLED", dueDate: "2026-01-01" }), // gecikmiş sayılmaz
      task({ id: "t4", status: "ARCHIVED", dueDate: "2026-01-01" }), // gecikmiş sayılmaz
      task({ id: "t5", status: "IN_PROGRESS", dueDate: "2026-01-20" }), // henüz gecikmemiş (todayYmd altında)
    ];
    const report = buildTaskReport(tasks, { startYmd: "2026-01-01", endYmd: "2026-01-31" }, "2026-01-15");
    expect(report.overdueCount).toBe(1);
  });

  it("son tarihi olmayan görev gecikmiş sayılmaz", () => {
    const tasks = [task({ id: "t1", status: "TODO" })];
    const report = buildTaskReport(tasks, { startYmd: "2026-01-01", endYmd: "2026-01-31" }, "2026-01-15");
    expect(report.overdueCount).toBe(0);
  });
});

describe("buildTaskReport — tamamlanma oranı", () => {
  it("pay=aralıkta tamamlanan, payda=aralıkta son tarihli görev sayısı", () => {
    const tasks = [
      task({ id: "t1", status: "COMPLETED", dueDate: "2026-01-05", completedAt: "2026-01-06" }), // pay+payda
      task({ id: "t2", status: "TODO", dueDate: "2026-01-10" }), // yalnız payda (tamamlanmadı)
      task({ id: "t3", status: "COMPLETED", dueDate: "2025-12-01", completedAt: "2025-12-20" }), // aralık dışı — ne pay ne payda
    ];
    const report = buildTaskReport(tasks, { startYmd: "2026-01-01", endYmd: "2026-01-31" }, "2026-01-15");
    expect(report.completed.inRange).toBe(1); // yalnızca t1
    expect(report.completed.dueInRange).toBe(2); // t1 ve t2
    expect(report.completed.ratePercent).toBe(50); // 1/2
  });

  it("payda sıfırsa oran null döner (0'a bölme yok)", () => {
    const tasks = [task({ id: "t1", status: "TODO" })];
    const report = buildTaskReport(tasks, { startYmd: "2026-01-01", endYmd: "2026-01-31" }, "2026-01-15");
    expect(report.completed.ratePercent).toBeNull();
    expect(report.completed.dueInRange).toBe(0);
  });

  it("aralık sınırları dahildir (startYmd ve endYmd'nin kendisi de sayılır)", () => {
    const tasks = [
      task({ id: "t1", status: "COMPLETED", dueDate: "2026-01-01", completedAt: "2026-01-01" }),
      task({ id: "t2", status: "COMPLETED", dueDate: "2026-01-31", completedAt: "2026-01-31" }),
      task({ id: "t3", status: "COMPLETED", dueDate: "2026-02-01", completedAt: "2026-02-01" }), // aralık dışı
    ];
    const report = buildTaskReport(tasks, { startYmd: "2026-01-01", endYmd: "2026-01-31" }, "2026-01-15");
    expect(report.completed.inRange).toBe(2);
    expect(report.completed.dueInRange).toBe(2);
  });
});

describe("buildTaskReport — sorumlu/kategori/öncelik kırılımı", () => {
  it("sorumlu bazında açık/gecikmiş/tamamlanan doğru toplanır", () => {
    const tasks = [
      task({ id: "t1", status: "TODO", assigneeId: "a1", dueDate: "2026-01-01" }),
      task({ id: "t2", status: "IN_PROGRESS", assigneeId: "a1" }),
      task({ id: "t3", status: "COMPLETED", assigneeId: "a1", completedAt: "2026-01-10" }),
      task({ id: "t4", status: "TODO", assigneeId: "a2" }),
      task({ id: "t5", status: "TODO" }), // atanmamış
    ];
    const report = buildTaskReport(tasks, { startYmd: "2026-01-01", endYmd: "2026-01-31" }, "2026-01-15");
    const a1 = report.byAssignee.find((r) => r.assigneeId === "a1")!;
    expect(a1.open).toBe(2);
    expect(a1.overdue).toBe(1);
    expect(a1.completedInRange).toBe(1);
    const unassigned = report.byAssignee.find((r) => r.assigneeId === null)!;
    expect(unassigned.open).toBe(1);
  });

  it("kategori/öncelik kırılımı yalnızca açık görevleri sayar", () => {
    const tasks = [
      task({ id: "t1", status: "TODO", category: "Tahsilat", priority: "HIGH" }),
      task({ id: "t2", status: "COMPLETED", category: "Tahsilat", priority: "HIGH" }), // sayılmaz
      task({ id: "t3", status: "IN_PROGRESS", category: "Evrak", priority: "LOW" }),
    ];
    const report = buildTaskReport(tasks, { startYmd: "2026-01-01", endYmd: "2026-01-31" }, "2026-01-15");
    expect(report.byCategory.find((r) => r.category === "Tahsilat")?.count).toBe(1);
    expect(report.byCategory.find((r) => r.category === "Evrak")?.count).toBe(1);
    expect(report.byPriority.find((r) => r.priority === "HIGH")?.count).toBe(1);
  });
});

describe("buildTaskReport — boş veri", () => {
  it("boş görev listesi güvenli, sıfır/null değerlerle döner", () => {
    const report = buildTaskReport([], { startYmd: "2026-01-01", endYmd: "2026-01-31" }, "2026-01-15");
    expect(report.totalTasks).toBe(0);
    expect(report.openWorkload).toEqual({ todo: 0, inProgress: 0, blocked: 0, total: 0 });
    expect(report.overdueCount).toBe(0);
    expect(report.completed.ratePercent).toBeNull();
    expect(report.byAssignee).toEqual([]);
    expect(report.byCategory).toEqual([]);
    expect(report.byPriority).toEqual([]);
  });
});

describe("defaultTaskReportRange", () => {
  it("bugün dahil son 30 günü kapsar (bugün-29 .. bugün)", () => {
    const range = defaultTaskReportRange("2026-01-30");
    expect(range.endYmd).toBe("2026-01-30");
    expect(range.startYmd).toBe("2026-01-01");
  });

  it("ay/yıl sınırında doğru hesaplar (timezone kaymasına karşı UTC-tabanlı hesap)", () => {
    const range = defaultTaskReportRange("2026-03-01");
    expect(range.endYmd).toBe("2026-03-01");
    // 2026-03-01'den 29 gün geri: Ocak 31 gün, dolayısıyla 2026-01-31.
    expect(range.startYmd).toBe("2026-01-31");
  });
});
