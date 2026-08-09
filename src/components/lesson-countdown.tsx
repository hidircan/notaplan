"use client";

/**
 * Paket 7 — "Dersi başlat" sonrası geri sayım. Planlanan süre (dakika) her
 * zaman `endAt - startAt`'tan türetilir (Lesson'da ayrı bir durationMinutes
 * kolonu yok) — tek kaynak, ayrı bir süre alanı icat edilmedi. `actualStartAt`
 * varsa (ders başlatılmış) saniyede bir tazelenen bir geri sayım gösterir;
 * süre dolunca "Ders süreniz doldu" uyarısına döner. Sunucudan yeni veri
 * çekmez — yalnızca zaten sayfada olan `actualStartAt`/durationu istemci
 * tarafında saatle karşılaştırır, bu yüzden ek bir API/polling YOK.
 */

import { useEffect, useState } from "react";

export function LessonCountdown({
  actualStartAt,
  plannedDurationMinutes,
}: {
  /** Ders "in_progress" değilse bu bileşen hiç render edilmemeli (çağıran taraf karar verir). */
  actualStartAt: string;
  plannedDurationMinutes: number;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const startMs = new Date(actualStartAt).getTime();
  const totalMs = plannedDurationMinutes * 60_000;
  const elapsedMs = now - startMs;
  const remainingMs = totalMs - elapsedMs;
  const overtime = remainingMs <= 0;
  const absSeconds = Math.floor(Math.abs(remainingMs) / 1000);
  const mm = String(Math.floor(absSeconds / 60)).padStart(2, "0");
  const ss = String(absSeconds % 60).padStart(2, "0");

  if (overtime) {
    return (
      <div
        role="alert"
        className="mt-1.5 rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-800"
      >
        Ders süreniz doldu. Lütfen dersi bitiriniz. (+{mm}:{ss})
      </div>
    );
  }

  const almostDone = remainingMs <= 5 * 60_000;

  return (
    <div
      className={`mt-1.5 inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium ${
        almostDone ? "border-amber-300 bg-amber-50 text-amber-800" : "border-cyan-200 bg-cyan-50 text-cyan-800"
      }`}
    >
      Kalan süre: {mm}:{ss}
    </div>
  );
}
