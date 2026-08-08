import { describe, it, expect } from "vitest";
import { groupTasksForCalendarMonth, isTaskOverdue } from "../task-calendar";
import type { Task } from "../types";

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: "t1",
    title: "Test",
    status: "TODO",
    priority: "MEDIUM",
    category: "Kayıt",
    followerIds: [],
    createdById: "u1",
    progressPercent: 0,
    tags: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("İş Takip takvim — groupTasksForCalendarMonth", () => {
  it("ayın her günü için doğru sayıda gün üretir (Ağustos 2026 — 31 gün)", () => {
    const result = groupTasksForCalendarMonth([], 2026, 8);
    expect(result.days).toHaveLength(31);
    expect(result.days[0]!.date).toBe("2026-08-01");
    expect(result.days[30]!.date).toBe("2026-08-31");
  });

  it("bir görevi doğru güne yerleştirir", () => {
    const task = makeTask({ id: "t2", dueDate: "2026-08-15T10:00:00.000Z" });
    const result = groupTasksForCalendarMonth([task], 2026, 8);
    const day15 = result.days.find((d) => d.date === "2026-08-15")!;
    expect(day15.tasks).toHaveLength(1);
    expect(day15.tasks[0]!.id).toBe("t2");
    const day14 = result.days.find((d) => d.date === "2026-08-14")!;
    expect(day14.tasks).toHaveLength(0);
  });

  it("son tarihi olmayan görevler 'undated' listesine gider, hiçbir günde kaybolmaz", () => {
    const undatedTask = makeTask({ id: "t3" });
    const datedTask = makeTask({ id: "t4", dueDate: "2026-08-05T00:00:00.000Z" });
    const result = groupTasksForCalendarMonth([undatedTask, datedTask], 2026, 8);
    expect(result.undated).toHaveLength(1);
    expect(result.undated[0]!.id).toBe("t3");
    expect(result.days.every((d) => !d.tasks.some((t) => t.id === "t3"))).toBe(true);
  });

  it("başka bir aya ait görev bu ayın hiçbir gününde görünmez", () => {
    const septemberTask = makeTask({ id: "t5", dueDate: "2026-09-01T00:00:00.000Z" });
    const result = groupTasksForCalendarMonth([septemberTask], 2026, 8);
    expect(result.days.every((d) => d.tasks.length === 0)).toBe(true);
    expect(result.undated).toHaveLength(0); // tarihi var, sadece başka ay — kaybolmamalı ama bu ayda değil
  });
});

describe("İş Takip takvim — isTaskOverdue", () => {
  it("son tarihi geçmiş VE açık statüdeki görev gecikmiş sayılır", () => {
    const task = makeTask({ dueDate: "2026-08-01T00:00:00.000Z", status: "IN_PROGRESS" });
    expect(isTaskOverdue(task, "2026-08-10")).toBe(true);
  });

  it("son tarihi geçmiş ama tamamlanmış/iptal/arşivlenmiş görev gecikmiş SAYILMAZ", () => {
    const completed = makeTask({ dueDate: "2026-08-01T00:00:00.000Z", status: "COMPLETED" });
    const cancelled = makeTask({ dueDate: "2026-08-01T00:00:00.000Z", status: "CANCELLED" });
    const archived = makeTask({ dueDate: "2026-08-01T00:00:00.000Z", status: "ARCHIVED" });
    expect(isTaskOverdue(completed, "2026-08-10")).toBe(false);
    expect(isTaskOverdue(cancelled, "2026-08-10")).toBe(false);
    expect(isTaskOverdue(archived, "2026-08-10")).toBe(false);
  });

  it("son tarihi olmayan görev asla gecikmiş sayılmaz", () => {
    const task = makeTask({});
    expect(isTaskOverdue(task, "2026-08-10")).toBe(false);
  });

  it("son tarihi bugün veya gelecekte olan görev gecikmiş sayılmaz", () => {
    const today = makeTask({ dueDate: "2026-08-10T00:00:00.000Z", status: "TODO" });
    const future = makeTask({ dueDate: "2026-08-11T00:00:00.000Z", status: "TODO" });
    expect(isTaskOverdue(today, "2026-08-10")).toBe(false);
    expect(isTaskOverdue(future, "2026-08-10")).toBe(false);
  });
});
