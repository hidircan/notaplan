"use client";

import { Sparkles } from "lucide-react";
import { useAssistant } from "./assistant-context";

/** Small CTA for pages that used to BE the chat — opens the global assistant instead. */
export function OpenAssistantCta({ label = "Asistanı aç" }: { label?: string }) {
  const { open } = useAssistant();
  return (
    <button
      type="button"
      onClick={() => open({ mode: "panel" })}
      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-violet-600/30 transition hover:shadow-md"
    >
      <Sparkles className="h-4 w-4" />
      {label}
    </button>
  );
}
