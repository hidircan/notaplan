/**
 * Test-only, deterministik açık ders slotu bulucu.
 *
 * KÖK NEDEN (flakiness): birden fazla test dosyasında (lesson-ops.test.ts,
 * lesson-ops-finance.test.ts, program-studio-flow.test.ts) yerel bir
 * `findOpenSlot` yardımcısı vardı ve bu yardımcı, ürünün gerçek kapalı-gün
 * kuralından (bkz. `isWeeklyClosedDayForTerm`, src/lib/attendance-calendar.ts
 * — `createLessonTool` bunu doğrudan kullanır) HABERSİZDİ: yalnızca
 * "bugün + N gün" ilerleyip ilk boş saati döndürüyordu, Pazartesi'yi hiç
 * atlamıyordu. Test paketi çalıştırıldığı gün bir Pazartesi'nin "+1..14 gün"
 * penceresine denk gelmesi yeterliydi — o zaman bu yardımcı Pazartesi bir
 * slot üretiyor, `createLessonTool` da (haklı olarak) "Pazartesi okul
 * kapalıdır" diye reddediyordu. Bu bir ÜRÜN hatası değil, yalnızca test
 * fixture'ının merkezi kurala kör olmasıydı.
 *
 * ÇÖZÜM: aynı merkezi kuralı (`isWeeklyClosedDayForTerm`) burada TEKRAR
 * YAZMADAN, doğrudan içe aktarıp kullanan TEK paylaşılan yardımcı. `term`
 * verilmezse (varsayılan) legacy davranış — yalnızca Pazartesi kapalı —
 * `createLessonTool`'un term'siz çağrılarıyla birebir aynıdır; `term`
 * verilirse Güz (yalnızca Pazartesi) / Yaz (Cumartesi+Pazar) kuralı uygulanır.
 * Böylece test hangi haftanın günü çalıştırılırsa çalıştırılsın (Pazartesi
 * dahil) geçerli bir açık gün/slot üretir — ürün validasyonu asla bypass
 * edilmez, yalnızca test tarafı artık aynı kuralı biliyor.
 */

import type { AppData, Instrument, StudentTermType } from "../../types";
import { isWeeklyClosedDayForTerm } from "../../attendance-calendar";
import { validateLessonSlot, type SlotValidationContext } from "../../makeup-engine";

export async function findOpenLessonSlot(
  data: AppData,
  studentId: string,
  teacherId: string,
  roomId: string,
  opts?: {
    /** Verilmezse LEGACY kural (yalnızca Pazartesi kapalı) uygulanır. */
    term?: StudentTermType;
    instrument?: Instrument;
    /** Kaç gün ileriye kadar denenecek (varsayılan 14 — eski yardımcılarla aynı). */
    maxOffsetDays?: number;
    /** Denenecek saat listesi (varsayılan 09–16 arası, eski yardımcılarla aynı). */
    hours?: number[];
    /**
     * "Bugün+N gün" yerine sabit bir referans tarihten ilerlemek isteyen
     * çağıranlar için — belirtilmezse `new Date()` (mevcut davranışla
     * geriye dönük uyumlu).
     */
    referenceDate?: Date;
  }
): Promise<string> {
  const referenceDate = opts?.referenceDate ?? new Date();
  const maxOffsetDays = opts?.maxOffsetDays ?? 14;
  const hours = opts?.hours ?? [9, 10, 11, 12, 13, 14, 15, 16];
  const context: SlotValidationContext = { instrument: opts?.instrument ?? "Piyano", studentId };

  for (let offset = 1; offset <= maxOffsetDays; offset++) {
    const day = new Date(referenceDate);
    day.setDate(day.getDate() + offset);
    // Merkezi kural — Güz'de yalnızca Pazartesi, Yaz'da Cts/Paz, term
    // verilmezse legacy (yalnızca Pazartesi). Paralel bir kopya YOK.
    if (isWeeklyClosedDayForTerm(day, opts?.term)) continue;
    for (const hour of hours) {
      const candidate = new Date(day);
      candidate.setHours(hour, 0, 0, 0);
      const candidateIso = candidate.toISOString();
      const check = validateLessonSlot(data, context, { teacherId, roomId, startAt: candidateIso });
      if (check.ok) return candidateIso;
    }
  }
  throw new Error("no open slot found");
}
