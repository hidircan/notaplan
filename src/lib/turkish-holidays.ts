/**
 * ÖNCELİK 4 — Türkiye resmî tatilleri (yerel/offline veri kaynağı).
 *
 * Ücretli bir dış API'ye bağımlı OLMAMAK için iki katmanlı bir yaklaşım:
 * 1) Sabit tarihli millî günler — `turkeyFixedPublicHolidays` (src/lib/closed-days.ts,
 *    daha önce yazılmıştı) her yıl için matematiksel olarak üretilir.
 * 2) Dini bayramlar (Ramazan/Kurban) her yıl Hicri takvime göre kayar — bu, sabit bir
 *    formülle güvenilir şekilde hesaplanamaz (yeni ay gözlemine bağlı resmî ilan
 *    farkı olabilir). Bu yüzden burada yıl başına ELLE bakımı yapılan, sabit bir
 *    tablo tutuyoruz (Diyanet/resmî takvim referans alınarak).
 *
 * NASIL GENİŞLETİLİR: `RELIGIOUS_HOLIDAYS` tablosuna yeni yıl(lar) eklemek için
 * o yılın Ramazan Bayramı (3.5 gün, arefe dahil) ve Kurban Bayramı (4.5 gün, arefe
 * dahil) tarihlerini resmî/doğrulanmış bir takvimden (Diyanet İşleri Başkanlığı vb.)
 * alıp aynı formatta ekleyin — Hicri takvim gözlem tabanlı kaydığı için buradan
 * TAHMİN/hesaplama YAPILMAZ, yalnızca doğrulanmış kaynaktan girilir. Şu an yalnız
 * 2024–2028 doldurulmuştur; 2029+ eklenmeden önce (ve genel olarak) eksik bir yıl
 * sistemi çökertmez — aşağıdaki tatiller yalnızca "bulunanlar" listelenir, eksik
 * yıl için dini tatil günleri kapalı olarak işaretlenmez, weekly/manual kurallar
 * yine de geçerli olur.
 */

import { turkeyFixedPublicHolidays } from "./closed-days";

export type HolidayEntry = { date: string; name: string };

/**
 * Arefe günleri dahil — okullar/kurumlar genelde arefe öğleden sonrasını da
 * kapalı sayar; burada tüm günü kapalı kabul ediyoruz (yarım gün ayrımı yok).
 */
const RELIGIOUS_HOLIDAYS: Record<number, HolidayEntry[]> = {
  2024: [
    { date: "2024-04-09", name: "Ramazan Bayramı Arefesi" },
    { date: "2024-04-10", name: "Ramazan Bayramı 1. Gün" },
    { date: "2024-04-11", name: "Ramazan Bayramı 2. Gün" },
    { date: "2024-04-12", name: "Ramazan Bayramı 3. Gün" },
    { date: "2024-06-15", name: "Kurban Bayramı Arefesi" },
    { date: "2024-06-16", name: "Kurban Bayramı 1. Gün" },
    { date: "2024-06-17", name: "Kurban Bayramı 2. Gün" },
    { date: "2024-06-18", name: "Kurban Bayramı 3. Gün" },
    { date: "2024-06-19", name: "Kurban Bayramı 4. Gün" },
  ],
  2025: [
    { date: "2025-03-29", name: "Ramazan Bayramı Arefesi" },
    { date: "2025-03-30", name: "Ramazan Bayramı 1. Gün" },
    { date: "2025-03-31", name: "Ramazan Bayramı 2. Gün" },
    { date: "2025-04-01", name: "Ramazan Bayramı 3. Gün" },
    { date: "2025-06-05", name: "Kurban Bayramı Arefesi" },
    { date: "2025-06-06", name: "Kurban Bayramı 1. Gün" },
    { date: "2025-06-07", name: "Kurban Bayramı 2. Gün" },
    { date: "2025-06-08", name: "Kurban Bayramı 3. Gün" },
    { date: "2025-06-09", name: "Kurban Bayramı 4. Gün" },
  ],
  2026: [
    { date: "2026-03-19", name: "Ramazan Bayramı Arefesi" },
    { date: "2026-03-20", name: "Ramazan Bayramı 1. Gün" },
    { date: "2026-03-21", name: "Ramazan Bayramı 2. Gün" },
    { date: "2026-03-22", name: "Ramazan Bayramı 3. Gün" },
    { date: "2026-05-26", name: "Kurban Bayramı Arefesi" },
    { date: "2026-05-27", name: "Kurban Bayramı 1. Gün" },
    { date: "2026-05-28", name: "Kurban Bayramı 2. Gün" },
    { date: "2026-05-29", name: "Kurban Bayramı 3. Gün" },
    { date: "2026-05-30", name: "Kurban Bayramı 4. Gün" },
  ],
  2027: [
    { date: "2027-03-09", name: "Ramazan Bayramı Arefesi" },
    { date: "2027-03-10", name: "Ramazan Bayramı 1. Gün" },
    { date: "2027-03-11", name: "Ramazan Bayramı 2. Gün" },
    { date: "2027-03-12", name: "Ramazan Bayramı 3. Gün" },
    { date: "2027-05-15", name: "Kurban Bayramı Arefesi" },
    { date: "2027-05-16", name: "Kurban Bayramı 1. Gün" },
    { date: "2027-05-17", name: "Kurban Bayramı 2. Gün" },
    { date: "2027-05-18", name: "Kurban Bayramı 3. Gün" },
    { date: "2027-05-19", name: "Kurban Bayramı 4. Gün" },
  ],
  2028: [
    { date: "2028-02-26", name: "Ramazan Bayramı Arefesi" },
    { date: "2028-02-27", name: "Ramazan Bayramı 1. Gün" },
    { date: "2028-02-28", name: "Ramazan Bayramı 2. Gün" },
    { date: "2028-02-29", name: "Ramazan Bayramı 3. Gün" },
    { date: "2028-05-04", name: "Kurban Bayramı Arefesi" },
    { date: "2028-05-05", name: "Kurban Bayramı 1. Gün" },
    { date: "2028-05-06", name: "Kurban Bayramı 2. Gün" },
    { date: "2028-05-07", name: "Kurban Bayramı 3. Gün" },
    { date: "2028-05-08", name: "Kurban Bayramı 4. Gün" },
  ],
};

/** Belirli bir yıl için TÜM resmî tatilleri (sabit + dini) döner, tarihe göre sıralı. */
export function turkishOfficialHolidays(year: number): HolidayEntry[] {
  const fixed = turkeyFixedPublicHolidays(year);
  const religious = RELIGIOUS_HOLIDAYS[year] ?? [];
  return [...fixed, ...religious].sort((a, b) => a.date.localeCompare(b.date));
}

/** yyyy-MM-dd -> o gün resmî tatil mi (ve adı)? */
export function findOfficialHoliday(dateYmd: string): HolidayEntry | undefined {
  const year = Number(dateYmd.slice(0, 4));
  if (!Number.isFinite(year)) return undefined;
  return turkishOfficialHolidays(year).find((h) => h.date === dateYmd);
}
