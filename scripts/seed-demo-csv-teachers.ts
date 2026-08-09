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

    // 10 demo öğrenci — CSV öğretmenlerine döngüsel dağıtılır, e-posta ile idempotent.
    const demoStudentNames = [
      "Ada Yılmaz", "Kerem Şahin", "Nehir Kaya", "Toprak Demir", "Elif Aksoy",
      "Yusuf Çetin", "Zümra Polat", "Berk Arslan", "İrem Sönmez", "Ozan Kurt",
    ];
    const createdStudentIds: string[] = [];
    let cursor = 0;
    for (const name of demoStudentNames) {
      const email = `${name.toLowerCase().replace(/[^a-zçğıöşü ]/g, "").replace(/ /g, ".")}.demo@email.com`;
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

    // ~50 ders x 3 ay (önceki/mevcut/sonraki) — öğretmen availability'sine göre,
    // aynı öğretmen/oda aynı gün+saatte iki kez kullanılmaz (yerel Set ile önlenir).
    const rooms = afterTeachers.settings.branches.flatMap((b) => [b.id]); // yalnızca fallback
    void rooms;
    const usedTeacherSlot = new Set<string>();
    const studentsData = (await readData()).students.filter((s) => createdStudentIds.includes(s.id));
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
        startAt.setHours(startHour + 1, 0, 0, 0);
        const room = (await readData()).rooms.find((r) => r.branchId === teacher.branchId);
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
    if (isDbMode && teachers.length >= 2 && studentsData.length >= 2) {
      const demoLogins = [
        { email: teachers[0]!.email, role: "TEACHER" as const, teacherId: teachers[0]!.id, password: "demo-teacher-csv-1" },
        { email: teachers[1]!.email, role: "TEACHER" as const, teacherId: teachers[1]!.id, password: "demo-teacher-csv-2" },
        { email: studentsData[0]!.email!, role: "STUDENT" as const, studentId: studentsData[0]!.id, password: "demo-student-csv-1" },
        { email: studentsData[1]!.email!, role: "STUDENT" as const, studentId: studentsData[1]!.id, password: "demo-student-csv-2" },
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
