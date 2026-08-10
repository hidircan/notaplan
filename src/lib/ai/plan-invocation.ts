/**
 * planAiInvocation — the single point where an API route/domain service asks
 * "should this AI call run for this caller, and with which provider?"
 * before ever reaching the agent executor or a domain service.
 *
 * METADATA + POLICY ONLY: reads `capabilities.ts` / `provider-chain.ts`,
 * touches no DB, calls no LLM. Fails CLOSED on any missing tenant/role —
 * mirrors the `db`-mode fail-closed direction called for in
 * DATABASE_ARCHITECTURE.md Gap DB-3 (no `DEFAULT_TENANT_ID`-style fallback
 * is introduced here, intentionally).
 */
import type { AppRole } from "../auth/types";
import { AI_CAPABILITIES, type AiCapabilityDefinition, type AiCapabilityId } from "./capabilities";
import { isKnownProvider, type ProviderId } from "./provider-chain";

export type AiApiContext = {
  /** From JWT — never from client-supplied input. */
  callerRole: AppRole;
  /** From JWT — never from client-supplied input, never a default fallback. */
  tenantId: string;
  /** Route/domain name for audit context, e.g. "attendance", "payments", "workflows". */
  operation: string;
};

export type AiInvocationPlan =
  | {
      allowed: true;
      capability: AiCapabilityDefinition;
      chosenProvider: ProviderId;
      /** Used by the executor if `chosenProvider` fails at runtime; undefined when already heuristic. */
      fallbackProvider?: ProviderId;
    }
  | {
      allowed: false;
      reason: string;
      capability?: AiCapabilityDefinition;
    };

function denied(reason: string, capability?: AiCapabilityDefinition): AiInvocationPlan {
  return { allowed: false, reason, capability };
}

/**
 * Basit tercih kuralı: preferred provider chain'de tanımlıysa onu kullan;
 * tanımlı değilse (yanlış yapılandırma) "heuristic"e düş. Gerçek bir
 * sağlık kontrolü/timeout mantığı yok — bkz. provider-chain.ts.
 */
function resolveProvider(preferred: ProviderId): { chosen: ProviderId; fallback?: ProviderId } {
  const chosen = isKnownProvider(preferred) ? preferred : "heuristic";
  return { chosen, fallback: chosen === "heuristic" ? undefined : "heuristic" };
}

export function planAiInvocation(
  capabilityId: AiCapabilityId | string,
  apiContext: AiApiContext
): AiInvocationPlan {
  if (!apiContext?.tenantId) {
    return denied("Kurum (tenant) bağlamı olmadan AI çağrısı planlanamaz.");
  }
  if (!apiContext?.callerRole) {
    return denied("Kullanıcı rolü olmadan AI çağrısı planlanamaz.");
  }

  const capability = AI_CAPABILITIES[capabilityId as AiCapabilityId];
  if (!capability) {
    return denied(`Bilinmeyen AI capability: "${capabilityId}".`);
  }

  if (!capability.allowedRoles.includes(apiContext.callerRole)) {
    return denied(
      `"${apiContext.callerRole}" rolü "${capability.id}" işlemini çalıştıramaz.`,
      capability
    );
  }

  const { chosen, fallback } = resolveProvider(capability.preferredProvider);
  return { allowed: true, capability, chosenProvider: chosen, fallbackProvider: fallback };
}
