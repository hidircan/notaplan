import { describe, it, expect } from "vitest";
import { computePagination } from "../../components/pagination-controls";

/**
 * `usePagination` React hook'unun ta kendisi component render testi
 * gerektirir (state/useMemo) — bu repoda component render testi altyapısı
 * (jsdom/@testing-library) KURULU DEĞİL (vitest.config.mts `environment:
 * "node"`, include yalnız `src/lib/__tests__/**\/*.test.ts`, yani `.tsx`
 * testleri zaten dahil bile edilmiyor). Bu yüzden hook'un paylaştığı SAF
 * sayfalama matematiği `computePagination` olarak çıkarılıp burada
 * doğrudan test edilir — `usePagination` yalnızca bunun üstüne ince bir
 * React state sarmalayıcısı (bkz. pagination-controls.tsx).
 *
 * "İki ayrı hook çağrısının state paylaşmadığı" iddiası yapısal olarak
 * doğrudur (her çağrı kendi `useState`'ini oluşturur) — bunu burada saf
 * fonksiyon testiyle kanıtlamaya çalışmak yapay/contrived olurdu; bu yüzden
 * yalnızca not ediliyor (öğrenci detayındaki üç bölüm — Yaklaşan/Geçmiş/
 * Yoklama — üç ayrı `usePagination` çağrısı kullanır).
 */
describe("computePagination — öğrenci detayı 3'lük sabit sayfalama matematiği", () => {
  it("3'e böler, doğru alt kümeyi döner", () => {
    const items = Array.from({ length: 7 }, (_, i) => i);
    const page1 = computePagination(items, 1, 3);
    expect(page1.pageItems).toEqual([0, 1, 2]);
    expect(page1.totalPages).toBe(3);
    expect(page1.totalCount).toBe(7);

    const page2 = computePagination(items, 2, 3);
    expect(page2.pageItems).toEqual([3, 4, 5]);

    const page3 = computePagination(items, 3, 3);
    expect(page3.pageItems).toEqual([6]);
  });

  it("boş listede totalPages en az 1'dir, pageItems boş döner (SmallPager render null olur — bkz. bileşen)", () => {
    const result = computePagination([], 1, 3);
    expect(result.totalPages).toBe(1);
    expect(result.pageItems).toEqual([]);
    expect(result.totalCount).toBe(0);
  });

  it("totalCount <= 3 olan listede tek sayfa vardır (bileşen SmallPager'ı gizler)", () => {
    const result = computePagination([1, 2, 3], 1, 3);
    expect(result.totalPages).toBe(1);
    expect(result.totalCount).toBe(3);
  });

  it("sayfa sınırlarının dışına çıkılamaz — istenen sayfa totalPages'ten büyükse en son sayfaya kırpılır", () => {
    const items = Array.from({ length: 5 }, (_, i) => i);
    const result = computePagination(items, 99, 3);
    expect(result.page).toBe(2); // totalPages = ceil(5/3) = 2
    expect(result.pageItems).toEqual([3, 4]);
  });

  it("istenen sayfa 1'in altındaysa 1'e kırpılır", () => {
    const items = Array.from({ length: 5 }, (_, i) => i);
    const result = computePagination(items, 0, 3);
    expect(result.page).toBe(1);
    expect(result.pageItems).toEqual([0, 1, 2]);
  });

  it("liste tam 3'ün katı olmayan bir uzunlukta olduğunda son sayfa eksik kalır", () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    const result = computePagination(items, 4, 3);
    expect(result.totalPages).toBe(4);
    expect(result.pageItems).toEqual([9]);
  });
});
