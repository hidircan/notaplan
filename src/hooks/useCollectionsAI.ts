"use client";

/**
 * Client hook for the collections-agent message-draft → human-approval
 * flow (US-05). Talks to `/api/ai/collections` + `/api/ai/collections/approve`
 * only — `tenantId`/role are derived server-side from the session on every
 * call; the `tenantId` param here is used ONLY to reset local state when the
 * active kurum changes, never sent as an auth parameter.
 *
 * Hook only — no UI. Never sends anything itself; approval only flips the
 * server-side `AiAuditLog.approvalStatus` (US-05/AC-11/AC-12 stay intact —
 * actual sending remains the existing, untouched Tahsilat UI).
 */
import { useCallback, useState } from "react";

export type CollectionsAIStatus =
  | "idle"
  | "pending_approval"
  | "completed"
  | "approved"
  | "rejected"
  | "error";

export type CollectionsAIDraft = { invocationId: string; text: string } | null;

type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

type GenerateDraftResponse = {
  result: { text: string };
  status: "pending_approval" | "completed";
  invocationId: string;
};

type IntakeScanResponse = {
  result: { text: string };
  status: "completed";
  invocationId: string;
};

type ApprovalResponse = {
  invocationId: string;
  approvalStatus: "approved" | "rejected";
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

export function useCollectionsAI(tenantId: string) {
  const [draft, setDraft] = useState<CollectionsAIDraft>(null);
  const [status, setStatus] = useState<CollectionsAIStatus>("idle");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Aktif kurum değişince ekrandaki eski taslak/duruma bağlı kalınmasın.
  // React'in "render sırasında state ayarlama" deseni (useEffect DEĞİL) —
  // ekstra bir render/flaş olmadan senkron şekilde sıfırlar.
  const [lastTenantId, setLastTenantId] = useState(tenantId);
  if (tenantId !== lastTenantId) {
    setLastTenantId(tenantId);
    setDraft(null);
    setStatus("idle");
    setError(null);
  }

  const generateDraft = useCallback(async (payload: Record<string, unknown> = {}) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await postJson<GenerateDraftResponse>("/api/ai/collections", {
        capabilityId: "collectionsMessageDraft",
        payload,
      });
      setDraft({ invocationId: data.invocationId, text: data.result.text });
      setStatus(data.status);
      return data;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Taslak oluşturulamadı.";
      setError(message);
      setStatus("error");
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const approveDraft = useCallback(async (invocationId: string, editedContent?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await postJson<ApprovalResponse>("/api/ai/collections/approve", {
        invocationId,
        approved: true,
        editedContent,
      });
      setStatus(data.approvalStatus);
      if (editedContent) {
        setDraft((current) => (current ? { ...current, text: editedContent } : current));
      }
      return data;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Taslak onaylanamadı.";
      setError(message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const rejectDraft = useCallback(async (invocationId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await postJson<ApprovalResponse>("/api/ai/collections/approve", {
        invocationId,
        approved: false,
      });
      setStatus(data.approvalStatus);
      return data;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Taslak reddedilemedi.";
      setError(message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // `collectionsIntake` — ayrı, bağımsız durum: `collectionsMessageDraft`
  // taslak/onay state machine'iyle (draft/status yukarıda) HİÇBİR alanı
  // paylaşmaz, aynı `/api/ai/collections` endpoint'ini farklı bir
  // capabilityId ile çağırır. Onay gerekmez (`status` her zaman "completed").
  const [intakeText, setIntakeText] = useState<string | null>(null);
  const [isIntakeLoading, setIsIntakeLoading] = useState(false);
  const [intakeError, setIntakeError] = useState<string | null>(null);

  const scanIntake = useCallback(async (payload: Record<string, unknown> = {}) => {
    setIsIntakeLoading(true);
    setIntakeError(null);
    try {
      const data = await postJson<IntakeScanResponse>("/api/ai/collections", {
        capabilityId: "collectionsIntake",
        payload,
      });
      setIntakeText(data.result.text);
      return data;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Tarama oluşturulamadı.";
      setIntakeError(message);
      throw e;
    } finally {
      setIsIntakeLoading(false);
    }
  }, []);

  return {
    draft,
    status,
    isLoading,
    error,
    generateDraft,
    approveDraft,
    rejectDraft,
    intakeText,
    isIntakeLoading,
    intakeError,
    scanIntake,
  };
}
