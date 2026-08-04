"use client";

import type { ReactNode } from "react";
import { TelafiSubmitButton } from "@/components/telafi-submit-button";

/**
 * EPIC 10 — onay/iptal/ret kararında karar notu ZORUNLU. Ayrı bir modal
 * yerine bilinçli olarak inline bir form kullanılıyor (kapsam/zaman kararı) —
 * fonksiyonel gereksinim (`required` textarea, boş gönderilemez) aynı,
 * yalnızca sunum daha basit.
 */
export function MakeupDecisionForm({
  action,
  hiddenFields,
  pendingLabel,
  variant,
  disabled,
  placeholder,
  children,
}: {
  action: (formData: FormData) => void;
  hiddenFields: Record<string, string>;
  pendingLabel: string;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  disabled?: boolean;
  placeholder?: string;
  children: ReactNode;
}) {
  return (
    <form action={action} className="flex flex-col gap-1.5">
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <textarea
        name="decisionNote"
        required
        rows={2}
        placeholder={placeholder ?? "Karar notu (zorunlu)…"}
        disabled={disabled}
        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none ring-violet-200 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      />
      <TelafiSubmitButton pendingLabel={pendingLabel} variant={variant} disabled={disabled}>
        {children}
      </TelafiSubmitButton>
    </form>
  );
}
