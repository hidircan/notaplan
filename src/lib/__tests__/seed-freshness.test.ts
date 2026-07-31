import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isSameDay, parseISO } from "date-fns";
import { createSeedData } from "../seed";
import { readData, resetData } from "../store-memory";

const ORIGINAL_TZ = process.env.TZ;
const TODAY_LESSON_IDS = ["l8", "l9", "l10", "l11"];

function clearMemoryStore() {
  delete (globalThis as { __notaplanByTenant?: unknown }).__notaplanByTenant;
}

describe("seed · createSeedData 'bugün' dersleri yerel güne sabitlenir", () => {
  beforeEach(() => {
    // Uygulama Türkiye (UTC+3) için çalışıyor; "bugün" hesabı bu saat dilimine göre doğrulanır.
    process.env.TZ = "Europe/Istanbul";
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env.TZ = ORIGINAL_TZ;
  });

  it("normal gündüz saatinde 'bugün' dersleri çağrı anındaki yerel güne üretilir", () => {
    const now = new Date("2026-08-05T07:00:00.000Z"); // yerel 5 Ağustos 10:00
    vi.setSystemTime(now);

    const data = createSeedData();
    const todayLessons = data.lessons.filter((l) => TODAY_LESSON_IDS.includes(l.id));
    expect(todayLessons).toHaveLength(TODAY_LESSON_IDS.length);
    for (const lesson of todayLessons) {
      expect(isSameDay(parseISO(lesson.startAt), now)).toBe(true);
    }
  });

  it("yerel gecenin erken saatlerinde (00:00-02:59) bile UTC gün kaymasına uğramaz", () => {
    // "Şimdi": yerel 5 Ağustos 01:30 (UTC 4 Ağustos 22:30) — UTC tarihi "bugün"den
    // farklı, ama yerel takvim günü aynı. Seed .toISOString().slice(0,10) gibi
    // kırılgan bir yaklaşım kullansaydı bu dersleri "dün"e kaydırırdı.
    const now = new Date("2026-08-04T22:30:00.000Z");
    vi.setSystemTime(now);

    const data = createSeedData();
    const todayLessons = data.lessons.filter((l) => TODAY_LESSON_IDS.includes(l.id));
    expect(todayLessons).toHaveLength(TODAY_LESSON_IDS.length);
    for (const lesson of todayLessons) {
      expect(isSameDay(parseISO(lesson.startAt), now)).toBe(true);
    }
  });
});

describe("store-memory · resetData demo verisini güncel güne yeniler", () => {
  beforeEach(() => {
    process.env.TZ = "Europe/Istanbul";
    vi.useFakeTimers();
    clearMemoryStore();
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env.TZ = ORIGINAL_TZ;
    clearMemoryStore();
  });

  it("zaman ilerledikten sonra resetData 'bugünkü' dersleri güncel yerel güne taşır", async () => {
    const dayA = new Date("2026-08-05T07:00:00.000Z"); // yerel 5 Ağustos
    vi.setSystemTime(dayA);

    const initial = await readData(); // ilk erişim — tenant için seed'i tembel şekilde oluşturur
    const lessonDayA = initial.lessons.find((l) => l.id === "l8");
    expect(lessonDayA).toBeDefined();
    expect(isSameDay(parseISO(lessonDayA!.startAt), dayA)).toBe(true);

    const dayB = new Date("2026-08-10T07:00:00.000Z"); // 5 gün sonra, yerel 10 Ağustos
    vi.setSystemTime(dayB);

    // Reset yapılmadan mevcut demo verisi hâlâ dayA'ya sabit kalır (beklenen kalıcılık).
    const stale = await readData();
    const staleLesson = stale.lessons.find((l) => l.id === "l8");
    expect(isSameDay(parseISO(staleLesson!.startAt), dayA)).toBe(true);
    expect(isSameDay(parseISO(staleLesson!.startAt), dayB)).toBe(false);

    // "Demo verisini sıfırla" tetiklendiğinde veri güncel güne yenilenmeli.
    const fresh = await resetData();
    const freshLesson = fresh.lessons.find((l) => l.id === "l8");
    expect(freshLesson).toBeDefined();
    expect(isSameDay(parseISO(freshLesson!.startAt), dayB)).toBe(true);
  });
});
