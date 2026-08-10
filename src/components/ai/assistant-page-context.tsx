"use client";

/**
 * Drop this into any (server or client) page to tell the global assistant
 * what the page is about, so its quick actions become entity-specific
 * ("Bu öğrencinin bakiyesi" instead of a generic prompt). Renders nothing.
 */
import { useAssistantEntity, type AssistantEntity } from "./assistant-context";

export function AssistantPageContext({ entity }: { entity: AssistantEntity }) {
  useAssistantEntity(entity);
  return null;
}
