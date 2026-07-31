import { describe, it, expect, beforeEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { addDays, startOfWeek } from "date-fns";
import { resolveDataDir } from "../config";
import { validateLessonSlot } from "../makeup-engine";
import { suggestLessonSlots } from "../lesson-scheduling";
import { createLessonTool } from "../services/tools";
import { readData } from "../store";
import { DEFAULT_TENANT_ID } from "../auth/config";
import type { ServiceContext } from "../services/context";

/** store-json.ts'in kendi çözdüğü dosya yoluyla aynı — VERCEL=1 test ortamında /tmp'e yönlenir. */
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

describe("Program Stüdyosu · öneri dışında manuel planlama", () => {
  it("öneri listesinde olmayan geçerli, elle seçilmiş bir saat de başarıyla planlanır", async () => {
    const data = await readData();
    const suggestions = suggestLessonSlots(data, { studentId: "s1", instrument: "Piyano" });
    expect(suggestions.length).toBeGreaterThan(0);
    const suggestedKeys = new Set(suggestions.map((s) => s.startAt));

    // Öneri motorunun taramadığı, ama gerçekte geçerli bir slotu elle bul.
    let manualStartAt: string | null = null;
    for (let offset = 1; offset <= 14 && !manualStartAt; offset++) {
      for (let hour = 9; hour <= 17 && !manualStartAt; hour++) {
        const d = new Date();
        d.setDate(d.getDate() + offset);
        d.setHours(hour, 0, 0, 0);
        const candidate = d.toISOString();
        if (suggestedKeys.has(candidate)) continue;
        const check = validateLessonSlot(
          data,
          { instrument: "Piyano", studentId: "s1" },
          { teacherId: "t1", roomId: "r1", startAt: candidate }
        );
        if (check.ok) manualStartAt = candidate;
      }
    }
    expect(manualStartAt).not.toBeNull();

    const res = await createLessonTool(ctx(), {
      studentId: "s1",
      teacherId: "t1",
      roomId: "r1",
      instrument: "Piyano",
      startAt: manualStartAt!,
    });
    expect(res.ok).toBe(true);
  });
});

describe("Program Stüdyosu · haftalık veri kaynağı", () => {
  it("yeni planlanan ders, hedef haftanın program verisinde görünür", async () => {
    const data = await readData();
    const teacher = data.teachers.find((t) => t.active && t.instruments.includes("Gitar"));
    const student = data.students.find((s) => s.active && s.instruments.includes("Gitar"));
    const room = data.rooms.find(
      (r) => r.instruments.includes("Gitar") && r.branchId === teacher!.branchId
    );

    let startAt: string | null = null;
    for (let offset = 1; offset <= 14 && !startAt; offset++) {
      for (let hour = 9; hour <= 17 && !startAt; hour++) {
        const d = new Date();
        d.setDate(d.getDate() + offset);
        d.setHours(hour, 0, 0, 0);
        const candidate = d.toISOString();
        const check = validateLessonSlot(
          data,
          { instrument: "Gitar", studentId: student!.id },
          { teacherId: teacher!.id, roomId: room!.id, startAt: candidate }
        );
        if (check.ok) startAt = candidate;
      }
    }
    expect(startAt).not.toBeNull();

    const res = await createLessonTool(ctx(), {
      studentId: student!.id,
      teacherId: teacher!.id,
      roomId: room!.id,
      instrument: "Gitar",
      startAt: startAt!,
    });
    expect(res.ok).toBe(true);

    // /panel/program'ın kullandığı aynı hafta-aralığı filtresi
    const created = new Date(startAt!);
    const weekStart = startOfWeek(created, { weekStartsOn: 1 });
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    const after = await readData();
    const weekLessons = after.lessons.filter((l) => {
      const d = new Date(l.startAt);
      return d >= days[0] && d <= addDays(days[6], 1);
    });

    expect(weekLessons.some((l) => l.startAt === startAt)).toBe(true);
  });
});
