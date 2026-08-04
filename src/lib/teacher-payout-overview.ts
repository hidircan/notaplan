import { format, parseISO } from "date-fns";
import type { AppData } from "./types";
import { computeTeacherEarningsForPeriod } from "./teacher-payout";

function dayKey(iso: string): string {
  return format(parseISO(iso), "yyyy-MM-dd");
}

export type TeacherPayoutOverview = {
  pendingTotal: number;
  paidTotal: number;
  missingFeeRuleLessonCount: number;
};

/**
 * Tüm öğretmenler için dönem özeti — mevcut `computeTeacherEarningsForPeriod`
 * dışında HİÇBİR hesaplama kuralı içermez, yalnızca öğretmen bazında çağırıp
 * toplar:
 * - `pendingTotal`: bu dönem için zaten bir `TeacherPayout` snapshot'ı varsa
 *   (status "pending") onun DONMUŞ tutarı; yoksa `computeTeacherEarningsForPeriod`
 *   ile canlı hesaplanan tutar (henüz resmi hakediş kaydı açılmamış öğretmenler
 *   için "şu an kapatılsa ne ödenir" tahmini).
 * - `paidTotal`: `paidAt` bu dönem içine düşen, status "paid" tüm payout'ların
 *   toplamı — dönemi (periodStart/periodEnd) değil, fiilen ÖDENDİĞİ tarihi
 *   baz alır.
 * - `missingFeeRuleLessonCount`: henüz payout'u oluşturulmamış öğretmenlerin
 *   bu dönemdeki eksik-ücret-kurallı tamamlanmış ders sayısı toplamı.
 */
export function computeTeacherPayoutOverview(
  data: AppData,
  periodStart: string,
  periodEnd: string
): TeacherPayoutOverview {
  let pendingTotal = 0;
  let missingFeeRuleLessonCount = 0;

  for (const teacher of data.teachers) {
    const existing = data.teacherPayouts.find(
      (p) => p.teacherId === teacher.id && p.periodStart === periodStart && p.periodEnd === periodEnd
    );
    if (existing) {
      if (existing.status === "pending") pendingTotal += existing.totalAmount;
      continue;
    }
    const earnings = computeTeacherEarningsForPeriod(data, teacher.id, periodStart, periodEnd);
    pendingTotal += earnings.totalAmount;
    missingFeeRuleLessonCount += earnings.missingFeeRuleLessonIds.length;
  }

  const periodStartKey = dayKey(periodStart);
  const periodEndKey = dayKey(periodEnd);
  const paidTotal = data.teacherPayouts
    .filter((p) => {
      if (p.status !== "paid" || !p.paidAt) return false;
      const paidKey = dayKey(p.paidAt);
      return paidKey >= periodStartKey && paidKey <= periodEndKey;
    })
    .reduce((sum, p) => sum + p.totalAmount, 0);

  return { pendingTotal, paidTotal, missingFeeRuleLessonCount };
}
