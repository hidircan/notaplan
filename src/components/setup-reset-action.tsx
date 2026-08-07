"use client";

/**
 * Kurulum Merkezi — demo veri sıfırlama ile boş şablona sıfırlama İKİ AYRI,
 * net etiketli eylemdir (bkz. src/lib/actions.ts actionResetDemo /
 * actionResetToCleanTemplate, src/lib/services/tools.ts resetDemoTool /
 * resetToCleanTemplateTool). İkisi de geri alınamaz olduğu için zorunlu onay
 * modalı arkasındadır — TeacherArchiveAction ile aynı desen.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function SetupResetAction({
  action,
  triggerLabel,
  triggerVariant = "secondary",
  title,
  bullets,
  confirmLabel,
}: {
  action: () => Promise<void>;
  triggerLabel: string;
  triggerVariant?: "secondary" | "danger";
  title: string;
  bullets: string[];
  confirmLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onConfirm() {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "İşlem başarısız oldu");
      }
    });
  }

  return (
    <div>
      <Button type="button" variant={triggerVariant} onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>

      {open ? (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label={title}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xl">
            <h3 className="text-base font-semibold text-[var(--color-text)]">{title}</h3>
            <ul className="mt-3 space-y-1.5 text-sm text-[var(--color-text-muted)]">
              {bullets.map((b) => (
                <li key={b}>• {b}</li>
              ))}
            </ul>
            {error ? (
              <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800" role="alert">
                {error}
              </p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
                İptal
              </Button>
              <button
                type="button"
                disabled={pending}
                onClick={onConfirm}
                className="rounded-lg bg-rose-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {pending ? "İşleniyor…" : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
