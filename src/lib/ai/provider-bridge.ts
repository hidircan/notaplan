/**
 * Bridges `plan-invocation.ts`'s decision to a REAL provider call.
 *
 * Chain-aware: `chosenProvider` is resolved to a real `LlmProvider` via
 * `provider-factory.ts`'s `resolveLiveProvider(id)`. If that provider is
 * unconfigured, times out, or errors, the NEXT provider in
 * `PROVIDER_CHAIN` (`provider-chain.ts`) is tried, and so on, until
 * `"heuristic"` (always configured) either succeeds or the whole chain has
 * failed. This replaces the earlier single-hop "anything non-heuristic goes
 * to whichever ONE provider getLlmProvider() resolves from env" bridge.
 */
import { resolveLiveProvider } from "./provider-factory";
import { planAiInvocation, type AiApiContext } from "./plan-invocation";
import type { AiCapabilityId } from "./capabilities";
import { nextProviderInChain, type ProviderId } from "./provider-chain";
import { recordAiAuditLog } from "./audit-hook";

export type ProviderExecutionPayload = {
  /** Task/prompt text handed to the provider's narrate() call. */
  prompt: string;
  /** Optional structured context appended for readability; never sent raw to DB. */
  context?: Record<string, unknown>;
};

export type ProviderExecutionResult = {
  /** The provider that actually produced `result` (last one tried, on success). */
  provider: ProviderId;
  result: { text: string };
  /** True when `provider` is not the capability's originally preferred provider. */
  usedFallback: boolean;
  /** Every provider attempted this invocation, in order, ending with `provider`. */
  triedProviders: ProviderId[];
};

/** Bridge context — same shape planAiInvocation expects, plus an optional
 * pre-generated audit row id so the caller (API route) and this bridge's
 * fire-and-forget audit write refer to the SAME invocation row. */
export type ProviderBridgeContext = AiApiContext & { invocationId?: string };

function promptWithContext(payload: ProviderExecutionPayload): string {
  if (!payload.context || Object.keys(payload.context).length === 0) return payload.prompt;
  return `${payload.prompt}\n\nBağlam: ${JSON.stringify(payload.context)}`;
}

async function runProvider(id: ProviderId, payload: ProviderExecutionPayload): Promise<string> {
  const provider = resolveLiveProvider(id);
  if (!provider) {
    throw new Error(`"${id}" provider'ı yapılandırılmamış (gerekli env değişkeni eksik).`);
  }
  const userMessage = promptWithContext(payload);
  return provider.narrate({ userMessage, toolResults: [] });
}

export async function executeWithProvider(
  capabilityId: AiCapabilityId,
  payload: ProviderExecutionPayload,
  context: ProviderBridgeContext
): Promise<ProviderExecutionResult> {
  const plan = planAiInvocation(capabilityId, context);
  if (!plan.allowed) {
    throw new Error(plan.reason);
  }

  const t0 = Date.now();
  const triedProviders: ProviderId[] = [];
  let current: ProviderId | undefined = plan.chosenProvider;
  let lastError: unknown;

  while (current) {
    triedProviders.push(current);
    try {
      const text = await runProvider(current, payload);
      const usedFallback = triedProviders.length > 1;

      // Fire-and-forget — never awaited in the critical (response) path.
      void recordAiAuditLog({
        id: context.invocationId,
        tenantId: context.tenantId,
        capabilityId,
        callerRole: context.callerRole,
        chosenProvider: current,
        usedFallback,
        success: true,
        durationMs: Date.now() - t0,
        approvalStatus: plan.capability.requiresApproval ? "pending_approval" : "not_required",
      });

      return { provider: current, result: { text }, usedFallback, triedProviders };
    } catch (err) {
      lastError = err;
      if (current === "heuristic") break; // last resort in the chain failed too
      current = nextProviderInChain(current);
    }
  }

  void recordAiAuditLog({
    id: context.invocationId,
    tenantId: context.tenantId,
    capabilityId,
    callerRole: context.callerRole,
    chosenProvider: triedProviders[triedProviders.length - 1] ?? plan.chosenProvider,
    usedFallback: triedProviders.length > 1,
    success: false,
    errorMessage: lastError instanceof Error ? lastError.message : "Tüm provider'lar başarısız oldu.",
    durationMs: Date.now() - t0,
    approvalStatus: plan.capability.requiresApproval ? "pending_approval" : "not_required",
  });
  throw lastError instanceof Error ? lastError : new Error("Tüm provider'lar başarısız oldu.");
}
