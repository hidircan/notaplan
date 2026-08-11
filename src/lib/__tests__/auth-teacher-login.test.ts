import { describe, it, expect } from "vitest";
import { authenticateUser } from "../auth/users";

/**
 * Regresyon — köke inen sebep: `src/lib/seed.ts`'teki t1..t7 öğretmenleri
 * (CSV'den içe aktarılan gerçek isim/e-posta) yalnızca `STORE_MODE=db`'de
 * (scripts/seed-demo-csv-teachers.ts çalıştırıldığında) bir auth `User`
 * satırına kavuşuyordu; `json`/`memory` modunda (testlerin çalıştığı mod —
 * bkz. CLAUDE.md "Test gotcha") BOOTSTRAP listesinde hiç karşılığı yoktu,
 * bu yüzden login-form.tsx'teki 7 öğretmen demo persona'sı her zaman
 * "Invalid email or password" ile başarısız oluyordu.
 */
describe("authenticateUser — CSV demo öğretmen girişi (json/memory bootstrap)", () => {
  it("aktif bir öğretmen kendi e-posta/şifresiyle başarıyla giriş yapabilir", async () => {
    const user = await authenticateUser("turgay.hosbas@niluferacar.com.tr", "demo-teacher-csv-1");
    expect(user).not.toBeNull();
    expect(user?.role).toBe("TEACHER");
    expect(user?.teacherId).toBe("t1");
  });

  it("e-posta baştaki/sondaki boşluk ve büyük/küçük harften bağımsız eşleşir", async () => {
    const user = await authenticateUser("  Turgay.Hosbas@NILUFERACAR.com.tr  ", "demo-teacher-csv-1");
    expect(user).not.toBeNull();
    expect(user?.teacherId).toBe("t1");
  });

  it("yanlış şifreyle giriş reddedilir (null döner, kullanıcı satırı var olsa da)", async () => {
    const user = await authenticateUser("turgay.hosbas@niluferacar.com.tr", "wrong-password");
    expect(user).toBeNull();
  });

  it("var olmayan bir e-postayla giriş reddedilir", async () => {
    const user = await authenticateUser("no-such-teacher@niluferacar.com.tr", "anything");
    expect(user).toBeNull();
  });

  it("her t1..t7 CSV öğretmeni kendi demo şifresiyle giriş yapabilir (mode parity)", async () => {
    const teachers = [
      ["turgay.hosbas@niluferacar.com.tr", "demo-teacher-csv-1", "t1"],
      ["olcay.ozdemir@niluferacar.com.tr", "demo-teacher-csv-2", "t2"],
      ["ebru.sirince@niluferacar.com.tr", "demo-teacher-csv-3", "t3"],
      ["sevval.aydin@niluferacar.com.tr", "demo-teacher-csv-4", "t4"],
      ["gokhan.keskin@niluferacar.com.tr", "demo-teacher-csv-5", "t5"],
      ["hilal.isci@niluferacar.com.tr", "demo-teacher-csv-6", "t6"],
      ["pinar.celik@niluferacar.com.tr", "demo-teacher-csv-7", "t7"],
    ] as const;
    for (const [email, password, teacherId] of teachers) {
      const user = await authenticateUser(email, password);
      expect(user, `${email} giriş yapamadı`).not.toBeNull();
      expect(user?.teacherId).toBe(teacherId);
    }
  });
});
