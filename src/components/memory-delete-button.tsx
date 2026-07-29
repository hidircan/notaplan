"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function MemoryDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    setBusy(true);
    try {
      await fetch("/api/v1/ai/memory", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={onDelete}
      className="text-xs font-medium text-rose-600 hover:underline disabled:opacity-50"
    >
      Sil
    </button>
  );
}
