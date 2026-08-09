import { describe, it, expect, beforeEach, vi } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { resolveDataDir } from "../config";
import { createTrialLessonTool } from "../services/tools";
import { DEFAULT_TENANT_ID } from "../auth/config";
import type { ServiceContext } from "../services/context";

/**
 * Deneme dersi planlaması normal ders serisinin sabit 30/40/50 dk
 * seçenekleriyle (bkz. src/lib/lesson-duration.ts LESSON_DURATION_OPTIONS)
 * SINIRLI DEĞİL — okul deneme dersini istediği süreyle (1-240 dk aralığında)
 * planlayabilmeli.
 */
const DATA_FILE = path.join(resolveDataDir(path.join(process.cwd(), "data")), "store.json");

vi.mock("../audit/log", () => ({ recordAuditLog: vi.fn().mockResolvedValue(undefined) }));

function ctx(overrides?: Partial<ServiceContext>): ServiceContext {
  return { role: "SCHOOL_ADMIN", userId: "u1", tenantId: DEFAULT_TENANT_ID, channel: "web", ...overrides };
}

beforeEach(async () => {
  await fs.rm(DATA_FILE, { force: true });
  vi.clearAllMocks();
});

const baseInput = {
  name: "Deneme Öğrencisi",
  phone: "05551234567",
  instrument: "Piyano",
  branchId: "erzene",
  teacherId: "t1",
  startAt: new Date(Date.now() + 3 * 86400000).toISOString(),
  notes: "",
};

describe("createTrialLessonTool — süre sınırı", () => {
  it("eskiden yalnızca 30/40/50 dk kabul edilirken artık serbest (ör. 15 dk) kabul edilir", async () => {
    const res = await createTrialLessonTool(ctx(), { ...baseInput, durationMinutes: 15 });
    expect(res.ok).toBe(true);
  });

  it("60 dk, 90 dk gibi normal ders serisinde olmayan süreler de kabul edilir", async () => {
    const res60 = await createTrialLessonTool(ctx(), {
      ...baseInput,
      startAt: new Date(Date.now() + 4 * 86400000).toISOString(),
      durationMinutes: 60,
    });
    expect(res60.ok).toBe(true);
    const res90 = await createTrialLessonTool(ctx(), {
      ...baseInput,
      startAt: new Date(Date.now() + 5 * 86400000).toISOString(),
      durationMinutes: 90,
    });
    expect(res90.ok).toBe(true);
  });

  it("30/40/50 hâlâ geçerli (geriye dönük uyumluluk)", async () => {
    for (const [i, dur] of [30, 40, 50].entries()) {
      const res = await createTrialLessonTool(ctx(), {
        ...baseInput,
        startAt: new Date(Date.now() + (10 + i) * 86400000).toISOString(),
        durationMinutes: dur,
      });
      expect(res.ok).toBe(true);
    }
  });

  it("makul aralık dışı (ör. 0 veya 500 dk) reddedilir", async () => {
    const resZero = await createTrialLessonTool(ctx(), { ...baseInput, durationMinutes: 0 });
    expect(resZero.ok).toBe(false);
    const resHuge = await createTrialLessonTool(ctx(), { ...baseInput, durationMinutes: 500 });
    expect(resHuge.ok).toBe(false);
  });
});
