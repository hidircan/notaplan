"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type Flag = "attended" | "processed" | "makeup";

export function LessonOpsActions({
  lessonId,
  studentAttended,
  lessonProcessed,
  opsMakeupFlag,
  compact = false,
}: {
  lessonId: string;
  studentAttended?: boolean;
  lessonProcessed?: boolean;
  opsMakeupFlag?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Flag | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState({
    attended: !!studentAttended,
    processed: !!lessonProcessed,
    makeup: !!opsMakeupFlag,
  });
  const inFlight = useRef(false);

  async function onFlag(flag: Flag) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(flag);
    setError(null);
    try {
      const res = await fetch(`/api/v1/lessons/${lessonId}/ops`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flag }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        data?: { alreadySet?: boolean; message?: string };
        error?: { message: string };
      };
      if (!json.ok) {
        setError(json.error?.message || "İşlem başarısız. Tekrar deneyin.");
        return;
      }
      setLocal((prev) => ({
        ...prev,
        attended: flag === "attended" ? true : prev.attended,
        processed: flag === "processed" ? true : prev.processed,
        makeup: flag === "makeup" ? true : prev.makeup,
      }));
      router.refresh();
    } catch {
      setError("Bağlantı hatası. Tekrar deneyin.");
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  const btn = (flag: Flag, label: string, active: boolean, tone: "green" | "red") => (
    <button
      type="button"
      disabled={busy !== null}
      aria-pressed={active}
      aria-label={label}
      onClick={() => void onFlag(flag)}
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-50",
        compact && "px-2 py-1 text-[11px]",
        active && tone === "green" && "border-[#2f6b4f] bg-[#e8f2ec] text-[#1e4d36]",
        active && tone === "red" && "border-[#8b3a3a] bg-[#f8ecec] text-[#6b2424]",
        !active && "border-stone-300 bg-white text-stone-800 hover:border-[#A56A00] hover:bg-[#fbf6ee]"
      )}
    >
      {busy === flag ? "…" : label}
    </button>
  );

  return (
    <div className={cn("mt-2", compact && "mt-1.5")}>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Ders operasyon durumları">
        {btn("attended", "Geldi", local.attended, "green")}
        {btn("processed", "İşlendi", local.processed, "green")}
        {btn("makeup", "Telafi", local.makeup, "red")}
      </div>
      {error ? (
        <p className="mt-1 text-[11px] font-medium text-[#8b3a3a]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function LessonOpsBadges({
  studentAttended,
  lessonProcessed,
  opsMakeupFlag,
}: {
  studentAttended?: boolean;
  lessonProcessed?: boolean;
  opsMakeupFlag?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {studentAttended ? (
        <span className="rounded-full bg-[#e8f2ec] px-2 py-0.5 text-[10px] font-semibold text-[#1e4d36]">
          Geldi
        </span>
      ) : null}
      {lessonProcessed ? (
        <span className="rounded-full bg-[#e8f2ec] px-2 py-0.5 text-[10px] font-semibold text-[#1e4d36]">
          İşlendi
        </span>
      ) : null}
      {opsMakeupFlag ? (
        <span className="rounded-full bg-[#f8ecec] px-2 py-0.5 text-[10px] font-semibold text-[#6b2424]">
          Telafi
        </span>
      ) : null}
    </div>
  );
}
