import type { TeacherPayout } from "./types";

/**
 * Öğretmen portalı erişim sınırlaması — saf yardımcılar. Hiçbir hesaplama
 * kuralı içermez, yalnızca "bu kayıt gerçekten bu öğretmene mi ait"
 * sorusunu yanıtlar. URL'den gelen bir payoutId başka bir öğretmene aitse
 * `findOwnPayout` her zaman `undefined` döner — çağıran taraf bunu "bulunamadı"
 * olarak göstermelidir, asla başka öğretmenin verisini sızdırmamalıdır.
 */

export function ownPayouts(payouts: TeacherPayout[], teacherId: string): TeacherPayout[] {
  return payouts.filter((p) => p.teacherId === teacherId);
}

export function findOwnPayout(
  payouts: TeacherPayout[],
  payoutId: string,
  teacherId: string
): TeacherPayout | undefined {
  const payout = payouts.find((p) => p.id === payoutId);
  if (!payout || payout.teacherId !== teacherId) return undefined;
  return payout;
}
