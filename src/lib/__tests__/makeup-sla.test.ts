import { describe, it, expect, beforeEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { resolveDataDir } from "../config";
import {
  computeSlaDeadline,
  resolveSlaEscalationLevel,
  inferMakeupReasonConfidence,
} from "../makeup-engine";
import { confirmMakeupLessonTool, checkMakeupSlaTool } from "../services/tools";
import { readData } from "../store";
import { DEFAULT_TENANT_ID } from "../auth/config";
import type { ServiceContext } from "../services/context";

const DATA_FILE = path.join(resolveDataDir(path.join(process.cwd(), "data")), "store.json");

function ctx(overrides?: Partial<ServiceContext>): ServiceContext {
  return {
    role: "SCHOOL_ADMIN",
    userId: "admin1",
    tenantId: DEFAULT_TENANT_ID,
    channel: "web",
    ...overrides,
  };
}

describe("computeSlaDeadline", () => {
  it("30 gün sonrasını hesaplar (varsayılan)", () => {
    expect(computeSlaDeadline("2026-01-01T00:00:00.000Z")).toBe("2026-01-31T00:00:00.000Z");
  });

  it("özel gün sayısını kabul eder", () => {
    expect(computeSlaDeadline("2026-01-01T00:00:00.000Z", 7)).toBe("2026-01-08T00:00:00.000Z");
  });
});

describe("resolveSlaEscalationLevel", () => {
  const deadline = "2026-02-01T00:00:00.000Z";

  it("16+ gün kala seviye 0 (henüz eşik yok)", () => {
    expect(resolveSlaEscalationLevel(deadline, "2026-01-15T00:00:00.000Z")).toBe(0);
  });

  it("tam 15 gün kala seviye 1", () => {
    expect(resolveSlaEscalationLevel(deadline, "2026-01-17T00:00:00.000Z")).toBe(1);
  });

  it("tam 7 gün kala seviye 2", () => {
    expect(resolveSlaEscalationLevel(deadline, "2026-01-25T00:00:00.000Z")).toBe(2);
  });

  it("tam 3 gün kala seviye 3", () => {
    expect(resolveSlaEscalationLevel(deadline, "2026-01-29T00:00:00.000Z")).toBe(3);
  });

  it("tam 1 gün kala seviye 4", () => {
    expect(resolveSlaEscalationLevel(deadline, "2026-01-31T00:00:00.000Z")).toBe(4);
  });

  it("son gün (0 gün kala) hâlâ seviye 4 — henüz aşılmadı", () => {
    expect(resolveSlaEscalationLevel(deadline, "2026-02-01T00:00:00.000Z")).toBe(4);
  });

  it("son tarihten sonrası seviye 5 (aşıldı)", () => {
    expect(resolveSlaEscalationLevel(deadline, "2026-02-02T00:00:00.000Z")).toBe(5);
  });
});

describe("inferMakeupReasonConfidence", () => {
  it("boş/tanımsız metin düşük güven döner", () => {
    expect(inferMakeupReasonConfidence(undefined).confidence).toBe("low");
    expect(inferMakeupReasonConfidence("").confidence).toBe("low");
    expect(inferMakeupReasonConfidence("   ").confidence).toBe("low");
  });

  it("çok kısa/anlamsız metin düşük güven döner", () => {
    expect(inferMakeupReasonConfidence("ok").confidence).toBe("low");
    expect(inferMakeupReasonConfidence("123456").confidence).toBe("low");
  });

  it("belirsiz ifadeler düşük güven döner", () => {
    expect(inferMakeupReasonConfidence("bilmiyorum henüz").confidence).toBe("low");
    expect(inferMakeupReasonConfidence("sonra söylerim size").confidence).toBe("low");
  });

  it("açık bir sebep yüksek güven döner", () => {
    const result = inferMakeupReasonConfidence("Çocuğum hastalandı, bugün gelemeyecek");
    expect(result.confidence).toBe("high");
    expect(result.reason).toContain("hastalandı");
  });
});

describe("checkMakeupSlaTool / confirmMakeupLessonTool — EPIC 10 entegrasyon", () => {
  beforeEach(async () => {
    await fs.rm(DATA_FILE, { force: true });
  });

  it("onay 30 günlük SLA'yı başlatır ve escalation seviyesi 0'dır", async () => {
    const before = await readData();
    const request = before.makeupRequests.find((m) => m.status === "pending" || m.status === "suggested");
    expect(request).toBeDefined();
    if (!request) return;

    const slot = {
      startAt: request.suggestedSlots[0]?.startAt,
      endAt: request.suggestedSlots[0]?.endAt,
      teacherId: request.teacherId,
      roomId: "r1",
      branchId: request.branchId,
      score: 90,
      reasons: ["test"],
    };
    // Eğer önerilen slot yoksa test bu talep için anlamsız — atla.
    if (!slot.startAt) return;

    const result = await confirmMakeupLessonTool(ctx(), {
      requestId: request.id,
      slot,
      decisionNote: "Veli ile telefonda konuşuldu, uygun.",
    });
    expect(result.ok).toBe(true);

    const after = await readData();
    const updated = after.makeupRequests.find((m) => m.id === request.id);
    expect(updated?.status).toBe("confirmed");
    expect(updated?.slaDeadline).toBeDefined();
    expect(updated?.slaEscalationLevel).toBe(0);
    expect(updated?.decisionNote).toBe("Veli ile telefonda konuşuldu, uygun.");
  });

  it("checkMakeupSlaTool: aynı eşik için tekrar çalıştırıldığında ikinci kez eskalasyon üretmez (idempotent)", async () => {
    const first = await checkMakeupSlaTool(ctx());
    expect(first.ok).toBe(true);
    const second = await checkMakeupSlaTool(ctx());
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      // Aynı taramayı hemen art arda çalıştırmak escalation seviyesini
      // ikinci kez YÜKSELTMEZ (zaten en güncel seviyedeyiz).
      expect(second.data.escalated.length).toBe(0);
    }
  });

  it("checkMakeupSlaTool SCHOOL_ADMIN/SUPER_ADMIN/AI_AGENT dışı bir rol tarafından çalıştırılamaz", async () => {
    const result = await checkMakeupSlaTool(ctx({ role: "TEACHER", teacherId: "t1" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
  });
});
