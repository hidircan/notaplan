import { describe, it, expect } from "vitest";
import { heuristicProvider } from "../ai/providers/heuristic";
import { getCapability } from "../ai/capabilities";
import type { ToolDescriptor } from "../ai/types";

const TOOLS: ToolDescriptor[] = [
  { name: "getStudentSchedule", description: "", requiredRoles: [] },
  { name: "getTeacherSchedule", description: "", requiredRoles: [] },
  { name: "getParentBalance", description: "", requiredRoles: [] },
  { name: "createPayment", description: "", requiredRoles: [] },
  { name: "findAvailableSlots", description: "", requiredRoles: [] },
  { name: "findAvailableTeachers", description: "", requiredRoles: [] },
  { name: "markAttendance", description: "", requiredRoles: [] },
];

function userTurn(content: string) {
  return [{ role: "user" as const, content }];
}

/** Mirrors provider-bridge.ts's `promptWithContext`/route's `buildPrompt`. */
function capabilityMessage(capabilityId: Parameters<typeof getCapability>[0], context: Record<string, unknown>) {
  const capability = getCapability(capabilityId)!;
  const hasContext = Object.keys(context).length > 0;
  const base = hasContext ? capability.description : `${capability.description} (ek bağlam verilmedi)`;
  return hasContext ? `${base}\n\nBağlam: ${JSON.stringify(context)}` : base;
}

describe("heuristicProvider.plan — ID eksikse uydurma/varsayılan ID kullanmaz, ne eksik olduğunu söyler", () => {
  it("'öğrenci bakiyesi' (ID yok) → bakiye sormaz, hangi öğrenci olduğunu sorar", async () => {
    const plan = await heuristicProvider.plan({
      messages: userTurn("öğrenci bakiyesi nedir"),
      tools: TOOLS,
    });
    expect(plan.toolCalls).toBeUndefined();
    expect(plan.assistantText).toMatch(/hangi öğrencinin/i);
  });

  it("'s1 bakiyesi' (ID var) → gerçek tool çağrısı üretir", async () => {
    const plan = await heuristicProvider.plan({
      messages: userTurn("s1 bakiyesi"),
      tools: TOOLS,
    });
    expect(plan.toolCalls).toEqual([{ tool: "getParentBalance", input: { studentId: "s1" } }]);
  });

  it("'telafi öner' (talep ID yok) → Telafi Merkezi'ndeki AI butonuna yönlendirir, uydurma ID kullanmaz", async () => {
    const plan = await heuristicProvider.plan({
      messages: userTurn("telafi öner"),
      tools: TOOLS,
    });
    expect(plan.toolCalls).toBeUndefined();
    expect(plan.assistantText).toMatch(/Telafi Merkezi/i);
  });

  it("'m1 için telafi slotu öner' (ID var) → gerçek tool çağrısı üretir", async () => {
    const plan = await heuristicProvider.plan({
      messages: userTurn("m1 için telafi slotu öner"),
      tools: TOOLS,
    });
    expect(plan.toolCalls).toEqual([{ tool: "findAvailableSlots", input: { requestId: "m1" } }]);
  });

  it("'yoklama özeti' → Yoklama ekranındaki butona yönlendirir, rastgele bir dersi işaretlemez", async () => {
    const plan = await heuristicProvider.plan({
      messages: userTurn("yoklama özeti"),
      tools: TOOLS,
    });
    expect(plan.toolCalls).toBeUndefined();
    expect(plan.assistantText).toMatch(/Yoklama ekranındaki/i);
  });

  it("'program' (ne öğrenci ne öğretmen ID'si) → kimin programı olduğunu sorar", async () => {
    const plan = await heuristicProvider.plan({
      messages: userTurn("program göster"),
      tools: TOOLS,
    });
    expect(plan.toolCalls).toBeUndefined();
    expect(plan.assistantText).toMatch(/kimin programını/i);
  });

  it("hiçbir kalıba uymayan istek için araç kataloğu döner (fırlatmaz)", async () => {
    const plan = await heuristicProvider.plan({
      messages: userTurn("bugün hava nasıl"),
      tools: TOOLS,
    });
    expect(plan.toolCalls).toBeUndefined();
    expect(plan.assistantText).toBeTruthy();
  });
});

describe("heuristicProvider.narrate — capability-context yolu (toolResults:[] ama Bağlam JSON'u var)", () => {
  it("attendanceDailySummary: sayıları gerçek metne döker", async () => {
    const userMessage = capabilityMessage("attendanceDailySummary", {
      date: "2026-08-10",
      totalLessons: 10,
      present: 7,
      late: 1,
      absent: 2,
      schoolCancelled: 0,
      notYetTaken: 0,
    });
    const text = await heuristicProvider.narrate({ userMessage, toolResults: [] });
    expect(text).toMatch(/10 ders/);
    expect(text).toMatch(/7 geldi/);
    expect(text).toMatch(/2 gelmedi/);
  });

  it("collectionsROIReport: parasal değerleri gerçek metne döker", async () => {
    const userMessage = capabilityMessage("collectionsROIReport", {
      trackedOutstanding: 12000,
      overdueCount: 3,
      attributedThisMonth: 5000,
      resolvedThisMonth: 2,
      lostThisMonth: 1,
      successRate: 0.66,
    });
    const text = await heuristicProvider.narrate({ userMessage, toolResults: [] });
    expect(text).toMatch(/3 gecikmiş kayıt/);
    expect(text).toMatch(/%66/);
  });

  it("teacherPerformanceScore: skoru ve yorumunu döker", async () => {
    const userMessage = capabilityMessage("teacherPerformanceScore", {
      teacherName: "Ada Öğretmen",
      score: 92,
      gradedLessonCount: 20,
      schoolCancelledCount: 0,
    });
    const text = await heuristicProvider.narrate({ userMessage, toolResults: [] });
    expect(text).toMatch(/Ada Öğretmen/);
    expect(text).toMatch(/92\/100/);
  });

  it("attendanceRiskAssessment: risk sayılarını ve öncelikli vakaları döker", async () => {
    const userMessage = capabilityMessage("attendanceRiskAssessment", {
      atRiskCount: 2,
      highRiskCount: 1,
      topCases: [{ studentName: "Ece", riskLevel: "high", absentCount: 4 }],
    });
    const text = await heuristicProvider.narrate({ userMessage, toolResults: [] });
    expect(text).toMatch(/2 öğrenci risk taşıyor/);
    expect(text).toMatch(/Ece/);
  });

  it("ek bağlam verilmediğinde de fırlatmaz, o capability için 'veri bulunamadı' der", async () => {
    const userMessage = capabilityMessage("attendanceDailySummary", {});
    const text = await heuristicProvider.narrate({ userMessage, toolResults: [] });
    expect(text).toMatch(/bulunamadı/);
  });

  it("bilinmeyen/eşleşmeyen bir mesaj için genel 'İsteğinizi işledim' DEĞİL, ne olduğunu açıklayan bir metin döner", async () => {
    const text = await heuristicProvider.narrate({ userMessage: "tamamen alakasız bir istek", toolResults: [] });
    expect(text).not.toBe("İsteğinizi işledim.");
    expect(text.length).toBeGreaterThan(0);
  });

  it("toolResults doluyken capability-context yolunu değil, tool özetini kullanır", async () => {
    const text = await heuristicProvider.narrate({
      userMessage: "test",
      toolResults: [{ tool: "getParentBalance", ok: true, data: { outstanding: 100, payments: [] } }],
    });
    expect(text).toMatch(/Bakiye/);
  });
});
