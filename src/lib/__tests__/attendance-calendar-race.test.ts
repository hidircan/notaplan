import { describe, it, expect } from "vitest";
import { shouldApplyMonthsResult } from "../../components/attendance-calendar-panel";

/**
 * Regresyon: AttendanceCalendarPanel'de term/yıl hızlı değiştirildiğinde,
 * önce başlayıp geç dönen bir `/month` isteğinin yanıtı, sonra başlayıp
 * erken dönen daha güncel bir isteğin sonucunu ARTIK EZMİYOR. Önceki
 * davranışta `setByMonth(results)` koşulsuzca (yalnızca bileşenden ayrılma
 * anındaki bir `cancelled` bayrağına bakarak, ki o da yanıt zaten
 * uygulandıktan SONRA kontrol ediliyordu) tüm haritayı değiştiriyordu —
 * bu da eski/yavaş bir yanıtın yeni state'i ezmesine yol açıyordu.
 */
describe("shouldApplyMonthsResult — yoklama takvimi yarış koşulu koruması", () => {
  it("en son başlatılan isteğin yanıtı uygulanır", () => {
    expect(shouldApplyMonthsResult(2, 2)).toBe(true);
  });

  it("önce başlayıp GEÇ dönen eski bir isteğin yanıtı, daha yeni bir istek başladıktan sonra reddedilir", () => {
    // Kullanıcı Güz -> Yaz -> Güz gibi hızlı geçiş yaptı: requestId 3'e
    // çıktı ama requestId 1'in yanıtı hâlâ ağda; artık bayat.
    expect(shouldApplyMonthsResult(3, 1)).toBe(false);
  });

  it("tek istek senaryosunda (yarış yok) her zaman uygulanır", () => {
    expect(shouldApplyMonthsResult(1, 1)).toBe(true);
  });
});
