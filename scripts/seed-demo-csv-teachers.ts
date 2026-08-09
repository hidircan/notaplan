/**
 * Paket 5 — demo ortamı için CSV'den öğretmen + demo öğrenci/kullanıcı/ders
 * verisi ekler. `src/lib/seed.ts`'in `createSeedData()` fonksiyonuna
 * (onlarca testin ve store-json/store-memory'nin paylaştığı, kritik bir
 * ortak fixture) KASITLI OLARAK DOKUNMAZ — bunun yerine mevcut demo tenant'a
 * (DEFAULT_TENANT_ID) EKLEME yapar, Tool Layer üzerinden (createTeacherTool/
 * createStudentTool/createLessonTool — RBAC, enstrüman/öğretmen doğrulaması
 * ve audit log dahil, mevcut kurallarla BİREBİR aynı yoldan).
 *
 * İdempotenlik: her adım önce "bu e-posta/isimle zaten bir kayıt var mı?"
 * diye kontrol eder ve varsa atlar — tekrar çalıştırmak yeni satır ÜRETMEZ.
 *
 * Yalnızca STORE_MODE=db için anlamlıdır (json/memory'de gerçek Prisma
 * kullanıcı satırı oluşturmaz, yalnızca dosya/bellek store'una ekler).
 * CSV ile GERÇEK içe aktarılmış veriyi SİLMEZ/ÜZERİNE YAZMAZ — yalnızca
 * `id` alanı `demo_csv_`/`demo_csv_teacher_` önekiyle başlayan, bu betiğin
 * kendi oluşturduğu kayıtları yönetir.
 *
 * Kullanım: STORE_MODE=db npx tsx scripts/seed-demo-csv-teachers.ts [csvYolu]
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { readData } from "../src/lib/store";
import { runWithTenantAsync } from "../src/lib/tenant-context";
import { DEFAULT_TENANT_ID } from "../src/lib/auth/config";
import {
  createTeacherTool,
  createStudentTool,
  createLessonTool,
  createRoomTool,
  archiveTeacherTool,
} from "../src/lib/services/tools";
import type { ServiceContext } from "../src/lib/services/context";
import { isDbMode } from "../src/lib/config";
import { hashPasswordSync } from "../src/lib/auth/password";
import { prisma } from "../src/lib/db";
import { uid } from "../src/lib/utils";
import { parseTeacherCsvContent } from "../src/lib/import/demo-teacher-csv";

const CSV_PATH = process.argv[2] || "/Users/hidircanyagiz/Documents/Öğretmenler.csv";

const ctx: ServiceContext = {
  role: "SCHOOL_ADMIN",
  tenantId: DEFAULT_TENANT_ID,
  userId: "seed_demo_csv_script",
};

function parseTeacherCsv(path: string) {
  return parseTeacherCsvContent(readFileSync(path, "utf-8"));
}

async function main() {
  await runWithTenantAsync(DEFAULT_TENANT_ID, async () => {
    const csvTeachers = parseTeacherCsv(CSV_PATH);
    console.log(`CSV'den ${csvTeachers.length} öğretmen okundu.`);

    const before = await readData();
    const branchByShortName = new Map(before.settings.branches.map((b) => [b.shortName, b.id]));

    const createdTeacherIds: string[] = [];
    for (const t of csvTeachers) {
      const existing = before.teachers.find((tt) => tt.email.toLowerCase() === t.email.toLowerCase());
      if (existing) {
        console.log(`Atlandı (zaten var): ${t.name} <${t.email}>`);
        createdTeacherIds.push(existing.id);
        continue;
      }
      const branchId = branchByShortName.get(t.branchName) ?? before.settings.branches[0]!.id;
      const res = await createTeacherTool(ctx, {
        name: t.name,
        email: t.email,
        phone: t.phone,
        branchId,
        instrument: t.instrument,
        availability: [
          { dayOfWeek: 1, start: "10:00", end: "19:00" },
          { dayOfWeek: 2, start: "10:00", end: "19:00" },
          { dayOfWeek: 3, start: "10:00", end: "19:00" },
          { dayOfWeek: 4, start: "10:00", end: "19:00" },
          { dayOfWeek: 5, start: "10:00", end: "18:00" },
          { dayOfWeek: 6, start: "10:00", end: "14:00" },
        ],
      });
      if (!res.ok) {
        console.error(`HATA — ${t.name}: ${res.error.message}`);
        continue;
      }
      console.log(`Oluşturuldu: ${t.name} <${t.email}> → ${res.data.teacherId}`);
      createdTeacherIds.push(res.data.teacherId);
    }

    const afterTeachers = await readData();
    const teachers = afterTeachers.teachers.filter((t) => createdTeacherIds.includes(t.id));
    if (teachers.length === 0) {
      console.log("Hiç öğretmen yok, öğrenci/ders üretimi atlanıyor.");
      return;
    }

    // `src/lib/seed.ts`'in başlangıç (createSeedData) seti — "eski demo
    // öğretmenler" — bu tenant'ta yalnızca db-modu ilk seed'inden (bkz.
    // scripts/seed-multi-tenant.ts) geliyorsa mevcuttur; sabit id'lerle
    // (t1..t5) tanınır. Görev: CSV öğretmenlerini AKTİF demo seti yap —
    // önce bu öğretmenlerin mevcut (seed-owned) öğrencilerini enstrüman
    // eşleşen bir CSV öğretmenine TAŞI (Tool Layer'da teacherId değişimi
    // desteklenmiyor — bkz. updateStudentProfileSchema yorumu — bu yüzden
    // burada doğrudan Prisma ile, yalnızca bu betiğin bildiği sabit s1..s8
    // demo öğrenci id'leri için), SONRA eski öğretmenleri archiveTeacherTool
    // ile pasifleştir (hard delete yok, geçmiş ders/ödeme kaydı korunur).
    const byEmail = (email: string) => teachers.find((t) => t.email.toLowerCase() === email.toLowerCase());
    const legacyReassignments: { studentId: string; newTeacherEmail: string; instrument?: string; branchId?: string }[] = [
      { studentId: "s1", newTeacherEmail: "7@mail.com" }, // Zeynep Arslan (Piyano/Erzene) → Pınar Çelik
      { studentId: "s2", newTeacherEmail: "2@mail.com", branchId: "evka3" }, // Emir Çelik (Gitar) → Olcay Özdemir (Evka3)
      { studentId: "s3", newTeacherEmail: "3@mail.com" }, // Defne Şahin (Keman/Evka3) → Ebru Şirince
      { studentId: "s4", newTeacherEmail: "5@mail.com" }, // Ali Koç (Bateri/Evka3) → Gökhan Keskin
      { studentId: "s5", newTeacherEmail: "7@mail.com", instrument: "Piyano" }, // Lara Yıldız (Şan → CSV'de Şan öğretmeni yok, Piyano'ya taşındı) → Pınar Çelik
      { studentId: "s6", newTeacherEmail: "2@mail.com", branchId: "evka3" }, // Burak Aydın (Gitar) → Olcay Özdemir (Evka3)
      { studentId: "s7", newTeacherEmail: "3@mail.com", instrument: "Keman" }, // İpek Demirtaş (Yan Flüt → CSV'de Yan Flüt öğretmeni yok, Keman'a taşındı) → Ebru Şirince
      { studentId: "s8", newTeacherEmail: "7@mail.com" }, // Kaan Ersoy (Piyano/Erzene) → Pınar Çelik
    ];
    if (isDbMode) {
      for (const r of legacyReassignments) {
        const newTeacher = byEmail(r.newTeacherEmail);
        const student = await prisma.student.findFirst({ where: { id: r.studentId, tenantId: DEFAULT_TENANT_ID } });
        if (!student || !newTeacher) continue;
        if (student.teacherId === newTeacher.id) continue; // zaten taşınmış — idempotent
        await prisma.student.update({
          where: { id: student.id },
          data: {
            teacherId: newTeacher.id,
            branchId: r.branchId ?? student.branchId,
            instruments: r.instrument ? [r.instrument] : (student.instruments ?? []),
          },
        });
        console.log(`Öğrenci taşındı: ${student.name} → ${newTeacher.name}`);
      }

      const legacyTeacherIds = ["t1", "t2", "t3", "t4", "t5"];
      for (const legacyId of legacyTeacherIds) {
        const legacy = await prisma.teacher.findFirst({ where: { id: legacyId, tenantId: DEFAULT_TENANT_ID } });
        if (!legacy || !legacy.active) continue; // yok veya zaten arşivli — idempotent
        const res = await archiveTeacherTool(ctx, { teacherId: legacy.id, archived: true });
        if (!res.ok) {
          console.error(`HATA — eski öğretmen arşivlenemedi (${legacy.name}): ${res.error.message}`);
          continue;
        }
        console.log(`Eski demo öğretmen arşivlendi: ${legacy.name}`);
      }
    }

    // 10 demo öğrenci — CSV öğretmenlerine döngüsel dağıtılır, e-posta ile idempotent.
    const demoStudentNames = [
      "Ada Yılmaz", "Kerem Şahin", "Nehir Kaya", "Toprak Demir", "Elif Aksoy",
      "Yusuf Çetin", "Zümra Polat", "Berk Arslan", "İrem Sönmez", "Ozan Kurt",
    ];
    const createdStudentIds: string[] = [];
    let cursor = 0;
    for (const name of demoStudentNames) {
      // E-posta yerel kısmı ASCII olmalı (zod email doğrulaması Türkçe
      // aksanlı karakterleri "Invalid input" ile reddediyor) — bu yüzden
      // Türkçe karakterler ASCII karşılıklarına çevrilir, ad/soyad Unicode
      // olarak `name` alanında zaten olduğu gibi korunur.
      const asciiName = name
        .replace(/ı/g, "i").replace(/İ/g, "I").replace(/ş/g, "s").replace(/Ş/g, "S")
        .replace(/ç/g, "c").replace(/Ç/g, "C").replace(/ğ/g, "g").replace(/Ğ/g, "G")
        .replace(/ü/g, "u").replace(/Ü/g, "U").replace(/ö/g, "o").replace(/Ö/g, "O");
      const email = `${asciiName.toLowerCase().replace(/[^a-z ]/g, "").replace(/ /g, ".")}.demo@email.com`;
      const dataNow = await readData();
      const existing = dataNow.students.find((s) => s.email?.toLowerCase() === email.toLowerCase());
      if (existing) {
        createdStudentIds.push(existing.id);
        continue;
      }
      const teacher = teachers[cursor % teachers.length]!;
      cursor += 1;
      const res = await createStudentTool(ctx, {
        name,
        email,
        phone: "0500 000 0000",
        parentName: `${name} velisi`,
        parentPhone: "0500 000 0001",
        branchId: teacher.branchId,
        instrument: teacher.instruments[0],
        teacherId: teacher.id,
        packageName: "Bireysel Aylık — 4 ders",
        weeklyLessonCount: 1,
        monthlyFee: 3200,
      });
      if (!res.ok) {
        console.error(`HATA — öğrenci ${name}: ${res.error.message}`);
        continue;
      }
      createdStudentIds.push(res.data.studentId);
      console.log(`Oluşturuldu (öğrenci): ${name}`);
    }

    // 10 demo öğrenci 7 öğretmene döngüsel dağıtılırken store'un iç sıralaması
    // CSV satır sırasıyla birebir örtüşmüyor — bu yüzden Hilal İşçi (Erzene,
    // Keman) hiç öğrenci alamayabiliyor. İsme göre idempotent: "Yusuf Çetin"
    // (Keman öğrenen bir demo öğrenci) varsa ve zaten Hilal'da değilse ona
    // taşınır — Hilal'ın enstrümanıyla (Keman) uyumlu, yalnızca şube/oda
    // ataması Erzene'ye güncellenir.
    const hilal = byEmail("6@mail.com");
    const yusuf = (await readData()).students.find((s) => s.email?.toLowerCase() === "yusuf.cetin.demo@email.com");
    if (hilal && yusuf && yusuf.teacherId !== hilal.id) {
      await prisma.student.update({
        where: { id: yusuf.id },
        data: { teacherId: hilal.id, branchId: hilal.branchId, instruments: ["Keman"] },
      });
      console.log(`Öğrenci taşındı: ${yusuf.name} → ${hilal.name}`);
    }

    // CSV'de Evka 3'te Piyano (2 öğretmen) + Gitar (1 öğretmen) var ama demo
    // tenant'ın mevcut oda seti Evka 3'te yalnız TEK piyano odası (r4) ve
    // Gitar odası içermiyor (yalnız Erzene'de r2) — bu, Gitar/2. Piyano
    // öğretmeninin sürekli aynı odayı paylaşıp oda çakışmasıyla
    // reddedilmesine yol açar. İsme göre idempotent şekilde eksik oda eklenir.
    const existingRooms = (await readData()).rooms;
    if (!existingRooms.some((r) => r.branchId === "evka3" && r.instruments.includes("Gitar"))) {
      const res = await createRoomTool(ctx, {
        name: "Stüdyo D — Gitar",
        branchId: "evka3",
        capacity: 2,
        instruments: ["Gitar"],
      });
      if (res.ok) console.log("Oda oluşturuldu: Stüdyo D — Gitar (Evka 3)");
    }

    // ~50 ders x 3 ay (önceki/mevcut/sonraki) — öğretmen availability'sine göre,
    // aynı öğretmen/oda aynı gün+saatte iki kez kullanılmaz (yerel Set ile önlenir).
    const rooms = afterTeachers.settings.branches.flatMap((b) => [b.id]); // yalnızca fallback
    void rooms;
    const usedTeacherSlot = new Set<string>();
    // Aynı şubede aynı enstrümanı öğreten birden fazla öğretmen tek bir
    // odayı paylaşabiliyor (ör. Evka 3'te 2 Piyano öğretmeni, tek piyano
    // odası) — çakışmayı azaltmak için bu öğretmenler arasında sıraya göre
    // saat kaydırması uygulanır (ilk öğretmen +1, ikincisi +3, ...).
    const roomShareOffset = new Map<string, number>();
    {
      const seenByRoomInstrument = new Map<string, number>();
      for (const t of teachers) {
        const key = `${t.branchId}|${t.instruments[0]}`;
        const count = seenByRoomInstrument.get(key) ?? 0;
        roomShareOffset.set(t.id, count * 2);
        seenByRoomInstrument.set(key, count + 1);
      }
    }
    // Yalnızca bu çalıştırmada oluşturulan 10 demo öğrenci değil, CSV
    // öğretmenlerine atanmış TÜM aktif öğrenciler (yukarıda taşınan eski
    // demo öğrenciler dahil) ders üretimine dahil edilir — aksi halde
    // yalnızca eski öğrencisi taşınan öğretmenler (ör. Pınar Çelik) hiç
    // ders alamaz.
    const teacherIdSet = new Set(teachers.map((t) => t.id));
    const studentsData = (await readData()).students.filter((s) => s.active && teacherIdSet.has(s.teacherId));
    let createdLessons = 0;
    const targetTotal = 150;
    for (let dayOffset = -45; dayOffset <= 45 && createdLessons < targetTotal; dayOffset++) {
      const now = new Date();
      const d = new Date(now);
      d.setDate(now.getDate() + dayOffset);
      const weekday = d.getDay();
      for (const teacher of teachers) {
        if (createdLessons >= targetTotal) break;
        const avail = teacher.availability.find((a) => a.dayOfWeek === weekday);
        if (!avail) continue;
        const startHour = Number(avail.start.slice(0, 2));
        const teacherKey = `${teacher.id}|${dayOffset}`;
        if (usedTeacherSlot.has(teacherKey)) continue;
        const studentsForTeacher = studentsData.filter((s) => s.teacherId === teacher.id);
        if (studentsForTeacher.length === 0) continue;
        const student = studentsForTeacher[Math.abs(dayOffset) % studentsForTeacher.length]!;
        const startAt = new Date(d);
        startAt.setHours(startHour + 1 + (roomShareOffset.get(teacher.id) ?? 0), 0, 0, 0);
        // Şubedeki TÜM odalar değil, öğretmenin enstrümanını destekleyen oda
        // seçilir — aksi halde aynı şubedeki farklı enstrüman öğretmenleri
        // hep aynı ilk odaya düşer ve gereksiz oda çakışmasıyla reddedilir.
        const roomsInBranch = (await readData()).rooms.filter((r) => r.branchId === teacher.branchId);
        const room =
          roomsInBranch.find((r) => r.instruments.includes(teacher.instruments[0]!)) ?? roomsInBranch[0];
        if (!room) continue;
        const res = await createLessonTool(ctx, {
          studentId: student.id,
          teacherId: teacher.id,
          roomId: room.id,
          instrument: teacher.instruments[0],
          startAt: startAt.toISOString(),
        });
        if (res.ok) {
          usedTeacherSlot.add(teacherKey);
          createdLessons += 1;
        }
      }
    }
    console.log(`Toplam ${createdLessons} demo ders oluşturuldu (önceki/mevcut/sonraki ay penceresi).`);

    // Görev — 2 öğretmen + 2 öğrenci demo GİRİŞ kullanıcısı. Yalnızca
    // STORE_MODE=db'de anlamlı (gerçek Prisma User satırı gerektirir);
    // e-posta ile idempotent (varsa atlanır, üretimi etkilemez — yalnızca bu
    // betiğin oluşturduğu demo tenant'taki kayıtlara dokunur).
    // Sabit, bu betiğe ÖZEL iki demo öğrenci (ilk iki `demoStudentNames`
    // girdisi) kullanılır — geniş `studentsData` (ders üretimi için TÜM
    // aktif öğrencileri kapsayan) listesinden DEĞİL, aksi halde her
    // çalıştırmada farklı bir öğrenci seçilip idempotentlik bozulur (yeni
    // login satırları birikir).
    const fixedDemoLoginStudents = (await readData()).students.filter((s) =>
      ["ada.yilmaz.demo@email.com", "kerem.sahin.demo@email.com"].includes(s.email?.toLowerCase() ?? "")
    );
    if (isDbMode && teachers.length >= 2 && fixedDemoLoginStudents.length >= 2) {
      const demoLogins = [
        { email: teachers[0]!.email, role: "TEACHER" as const, teacherId: teachers[0]!.id, password: "demo-teacher-csv-1" },
        { email: teachers[1]!.email, role: "TEACHER" as const, teacherId: teachers[1]!.id, password: "demo-teacher-csv-2" },
        { email: fixedDemoLoginStudents[0]!.email!, role: "STUDENT" as const, studentId: fixedDemoLoginStudents[0]!.id, password: "demo-student-csv-1" },
        { email: fixedDemoLoginStudents[1]!.email!, role: "STUDENT" as const, studentId: fixedDemoLoginStudents[1]!.id, password: "demo-student-csv-2" },
      ];
      for (const login of demoLogins) {
        const existing = await prisma.user.findFirst({ where: { tenantId: DEFAULT_TENANT_ID, email: login.email } });
        if (existing) {
          console.log(`Giriş kullanıcısı zaten var: ${login.email}`);
          continue;
        }
        await prisma.user.create({
          data: {
            id: uid("user"),
            tenantId: DEFAULT_TENANT_ID,
            email: login.email,
            passwordHash: hashPasswordSync(process.env[`AUTH_DEMO_CSV_${login.email}`] || login.password),
            role: login.role,
            teacherId: "teacherId" in login ? login.teacherId : undefined,
            studentId: "studentId" in login ? login.studentId : undefined,
            active: true,
          },
        });
        console.log(`Demo giriş kullanıcısı oluşturuldu: ${login.email} (${login.role})`);
      }
    }
  });
}

main()
  .then(() => {
    console.log("Demo CSV öğretmen/öğrenci/ders seed tamamlandı.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed hata ile sonlandı:", err);
    process.exit(1);
  });
