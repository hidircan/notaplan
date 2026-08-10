"use client";

/**
 * Client hook for the read-only, no-approval AI capabilities
 * (attendanceDailySummary / makeupSlotSuggestion / collectionsROIReport /
 * teacherPerformanceScore / attendanceRiskAssessment) — talks to
 * `/api/ai/insights` only. `tenantId`/role are derived server-side from the
 * session on every call.
 */
import { useCallback, useState } from "react";

export type InsightCapabilityId =
  | "attendanceDailySummary"
  | "makeupSlotSuggestion"
  | "collectionsROIReport"
  | "teacherPerformanceScore"
  | "attendanceRiskAssessment";

type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

type InsightResponse = {
  result: { text: string };
  status: "completed";
  invocationId: string;
};

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!json) throw new Error("Sunucudan geçersiz yanıt alındı.");
  if (!json.ok) throw new Error(json.error.message);
  return json.data;
}

export function useAiInsight(capabilityId: InsightCapabilityId) {
  const [text, setText] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (payload: Record<string, unknown> = {}) => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await postJson<InsightResponse>("/api/ai/insights", { capabilityId, payload });
        setText(data.result.text);
        return data;
      } catch (e) {
        const message = e instanceof Error ? e.message : "AI analizi oluşturulamadı.";
        setError(message);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [capabilityId]
  );

  return { text, isLoading, error, generate };
}
