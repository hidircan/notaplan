/**
 * Maps `capabilities.ts` `linkedTools` → Gemini function-calling
 * `ToolDescriptor[]` (the same shape `providers/gemini.ts`'s
 * `toolsToGemini()` expects).
 *
 * READS the agent tool registry (`listToolDefinitions`, `isRegisteredTool`)
 * — never modifies it, and reuses `listToolDefinitions()`'s existing
 * zod→JSON-schema-lite conversion (the same one `executor.ts`'s
 * `listToolsForRole` uses) instead of passing a raw zod schema. Some
 * `linkedTools` entries (e.g. `upsertFollowUpCase`, `getCollectionRoi`) are
 * plain `tahsilat/cases.ts` functions, not agent tools — they are
 * intentionally skipped here (warn + continue), since only registered agent
 * tools can be exposed as callable functions to an LLM.
 */
import { isRegisteredTool, listToolDefinitions } from "../agent";
import type { ToolDescriptor } from "./types";
import { getCapability, type AiCapabilityId } from "./capabilities";

/**
 * Resolves one capability's `linkedTools` to Gemini-ready `ToolDescriptor[]`.
 * A missing/unregistered tool name never throws — it is skipped with a
 * console warning so a typo in `capabilities.ts` degrades gracefully
 * instead of breaking the whole capability.
 */
export function buildGeminiToolDescriptors(capabilityId: AiCapabilityId): ToolDescriptor[] {
  const capability = getCapability(capabilityId);
  if (!capability) {
    console.warn(`[gemini-tools] Bilinmeyen capability: "${capabilityId}" — boş araç listesi döndürülüyor.`);
    return [];
  }

  const registryByName = new Map(listToolDefinitions().map((t) => [t.name, t]));
  const descriptors: ToolDescriptor[] = [];
  for (const toolName of capability.linkedTools) {
    if (!isRegisteredTool(toolName)) {
      console.warn(
        `[gemini-tools] "${toolName}" (capability: ${capabilityId}) agent tool registry'de yok — atlanıyor.`
      );
      continue;
    }
    const def = registryByName.get(toolName);
    if (!def) continue; // defensive — isRegisteredTool already guarantees this, never happens
    descriptors.push({
      name: def.name,
      description: def.description,
      requiredRoles: def.requiredRoles,
      inputSchema: def.inputSchema,
    });
  }
  return descriptors;
}

/** Roles-filtered variant — only tools the caller's role may invoke are exposed. */
export function buildGeminiToolDescriptorsForRole(
  capabilityId: AiCapabilityId,
  callerRole: string
): ToolDescriptor[] {
  return buildGeminiToolDescriptors(capabilityId).filter(
    (t) => callerRole === "SUPER_ADMIN" || t.requiredRoles.includes(callerRole)
  );
}
