# IMPLEMENTATION_PLAN.md

> Bu doküman EPIC 0–10'un uçtan uca uygulama planıdır. `PROJECT.md`/`AGENTS.md` ile
> çelişen bir madde bulunursa (mimari kural, roller, validation gate sırası vb.)
> onlar geçerlidir — bu doküman onların altında, sprint-seviyesinde bir plandır.
> Her epic tamamlandığında bu dosyadaki "Durum" alanı güncellenir; plan yaşayan bir
> belgedir, tek seferlik bir rapor değildir.

## 0. Keşif bulguları (tüm epic'leri etkileyen ortak gerçekler)

Uygulamaya başlamadan önce mevcut koda bakınca ortaya çıkan, planı doğrudan şekillendiren
bulgular:

1. **Genel audit log şu an bir NO-OP.** `src/lib/auth/audit.ts`'teki `auditLog()` hiçbir
   yere yazmıyor — yalnızca `AUDIT_LOG_DEBUG=1` iken stdout'a basıyor
   (`// intentionally empty — hook for future persistence`). Yalnızca AI capability
   çağrıları (`AiAuditLog` / `src/lib/ai/audit-hook.ts`) gerçekten kalıcı. **Bu EPIC 0'ın
   tek en kritik bulgusu** — "kritik işlemlerde audit log oluşuyor" kabul kriteri bugün
   hiçbir insan-tetikli işlem için sağlanmıyor.
2. **`WorkflowState` tenant'sız.** `prisma/schema.prisma`'da `WorkflowState` modelinde
   `tenantId` yok — tek, global bir satır seti. `PRODUCTION_AUDIT.md`/`PROJECT.md`'de
   zaten "known gap" olarak işaretli. EPIC 0 kapsamında ele alınmalı.
3. **`AiAuditLog` yalnızca `STORE_MODE=db`'de kalıcı.** json/memory modunda audit yazımı
   sessizce başarısız olur (try/catch, `persisted:false` döner). Bu, repodaki KABUL
   EDİLMİŞ bir tasarım kararı (kod yorumunda açık) — yeni genel `AuditLog` modeli de
   AYNI deseni izleyecek (bkz. EPIC 0). "Mode parity" ilkesine bilinçli, dokümante edilmiş
   bir istisna.
4. **Öğretmen ücreti zaten versiyonlu ve dondurulmuş.** `TeacherFeeRule`
   (`effectiveFrom`/`effectiveTo`, çakışma doğrulaması) ve `TeacherPayout` (oluşturma
   anında donan snapshot, bir daha yeniden hesaplanmaz) ZATEN doğru şekilde inşa edilmiş
   (`src/lib/teacher-payout.ts`). EPIC 3'ün "geçmiş dersler yeni oranla etkilenmesin"
   kabul kriteri bugün zaten sağlanıyor. Yapılacak iş, dakika-bazlı sunumu saatlik
   sunuma çevirmek ve kesirli-süre/tip-bazlı kuralları eklemek — hesaplama motorunu
   yeniden inşa etmek değil.
5. **Tahsilat vaka altyapısı zaten var, otomatik tarama yok.** `PaymentFollowUpCase`
   (Prisma) + `src/lib/tahsilat/cases.ts` (json/db parity) zaten `draft → approved →
   sent → replied → paid | lost` durum makinesini, `markPaymentCasesPaid` (ödeme
   tamamlanınca otomatik kapatma) ve ROI hesaplamayı içeriyor. **Eksik olan**:
   (a) gerçek bir "tüm gecikmiş ödemeleri tara" job'ı — bugünkü `payment_reminders`
   workflow'u yalnızca ilk 4 demo öğrenciyi sabit kodlanmış şekilde tarıyor ve tahsilat
   vaka sistemini hiç kullanmıyor, doğrudan `sendParentMessage` çağırıyor; (b) uygulama
   içi bildirim modeli (hiç yok); (c) mesaj sıklık limiti / opt-out alanı (hiç yok).
6. **WhatsApp gönderimi varsayılan olarak `wa.me` linki — programatik "teslim edildi"
   sinyali yok.** `getWhatsAppTransport()` soyutlaması Meta/Twilio/Evolution
   sağlayıcılarını destekliyor ama repo varsayılanı insan onaylı `wa.me` deep link
   (bkz. `TahsilatMessageApproval`: "Onayla → WhatsApp'ta aç"). Gerçek "teslim
   edildi/okundu" durumu yalnızca gerçek bir webhook sağlayıcısı bağlıysa mümkün; `wa.me`
   linkinde yalnızca "kullanıcı linke tıkladı" (client-side) izlenebilir. Plan bunu
   açıkça iki kademeli olarak ele alıyor.
7. **`STUDENT` rolü yok.** Bugün 5 rol var: `SUPER_ADMIN, SCHOOL_ADMIN, TEACHER, PARENT,
   AI_AGENT` (`src/lib/auth/types.ts`). EPIC 6'nın "öğrenci portalı" isteği yeni bir
   `STUDENT` rolü gerektiriyor — bu `AppRole` union'ını, JWT claim'lerini, RBAC
   matrisini, tool registry `requiredRoles`'larını ve `middleware.ts` route guard'ını
   etkileyen, tek başına büyük bir değişiklik. EPIC 6 içinde ayrı bir alt-adım olarak
   planlandı.
8. **Duyuru, dosya/video, gelişim değerlendirmesi, ders başlangıç/bitiş, öğretmen
   müsaitlik-onay modelleri hiç yok.** EPIC 5, 6, 7, 8, 9 tamamen yeni Prisma modelleri
   + `AppData`/json-mode karşılıkları gerektiriyor. "Geçmiş veri korunması" bu epic'ler
   için N/A — yeni tablo, geçmiş veri yok; risk tamamen ileri yönlü (yeni yazımların
   tenant/RBAC'ı doğru uygulaması).
9. **CSV export hiç yok** — yalnızca CSV *import* var (`src/lib/import/*`,
   `actionPreview*Import`/`actionCommit*Import`). EPIC 0'ın export gereksinimi sıfırdan.
10. **"Mode parity" vergisi her yeni alanda tekrar eder.** Her yeni alan/model,
    `prisma/schema.prisma` + `src/lib/types.ts` (json/memory) + `store-json.ts` +
    `store-memory.ts` + `store-db.ts` (Prisma ⇄ AppData mapping) + `seed.ts` +
    `src/lib/validation.ts` (zod) + ilgili tool/service fonksiyonu + UI olmak üzere
    en az 7 dosyayı aynı anda değiştirmeyi gerektiriyor. Aşağıdaki her epic'in
    "Etkilenen dosyalar" listesi bunu ayrı ayrı tekrarlamak yerine bu deseni referans
    verir.

## 1. Rol/Yetki matrisi (EPIC 0'ın parçası, tüm epic'ler bu tabloya göre yazılır)

| Kaynak / işlem | SUPER_ADMIN | SCHOOL_ADMIN | TEACHER | PARENT | (yeni) STUDENT | AI_AGENT |
|---|---|---|---|---|---|---|
| Kendi kurumu dışı veri | ❌ (SUPER_ADMIN "tüm kurumlar" görünümünde **salt okunur, birleşik**) | ❌ | ❌ | ❌ | ❌ | ❌ |
| Öğrenci/veli/öğretmen CRUD | ✅ | ✅ | okuma (kendi öğrencileri) | okuma (kendi çocuğu) | okuma (kendi profili) | ✅ (tool guard'lı) |
| Ödeme yazma / tahsilat mesajı onayı | ✅ | ✅ | ❌ | ❌ (yalnız okuma+opt-out) | ❌ | taslak (onay gerekli) |
| Öğretmen ücret tanımı | ✅ | ✅ (kurum sahibi/yetkili yönetici) | ❌ (yalnız kendi özetini okur) | ❌ | ❌ | ❌ |
| Telafi karar (onay/ret/iptal) | ✅ | ✅ | öneri/not | ❌ (yalnız kendi talebini görür) | ❌ | öneri (insan onayı şart) |
| Duyuru oluşturma | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Gelişim değerlendirmesi oluşturma | okuma | okuma | ✅ (yalnız kendi öğrencisi) | okuma (kendi çocuğu) | okuma (kendisi, ayarlanabilir) | ❌ |
| Ders başlat/bitir | okuma+düzeltme | okuma+düzeltme | ✅ (kendi dersi) | canlı durum okuma | canlı durum okuma | ❌ |
| Öğretmen müsaitlik girişi | onay | onay | ✅ (öneri, onay bekler) | ❌ | ❌ | ❌ |
| Kurum verisi export | ✅ (yalnız aktif seçili TEK kurum; "tüm kurumlar" görünümünde export kapalı) | ✅ (yalnız kendi kurumu) | ❌ | ❌ | ❌ | ❌ |

`SUPER_ADMIN` RBAC bypass'ı (`requireRole` içinde) korunuyor; export/silme gibi
**tenant-yazma niteliğindeki** işlemler için bu bypass bilinçli olarak "tek kurum
seçili olmalı" kısıtına tabi tutuluyor (mevcut "tüm kurumlar görünümünde işlem
yapılamaz" desenine paralel).

---

## EPIC 0 — Veri güvenliği, taşınabilirlik, yedekleme [P0]

**Durum:** 🟡 Planlandı → uygulanıyor (bu turda)

### Mevcut durum
Tenant izolasyonu (ALS + JWT, `readData()`, `canAccessStudent`/`canAccessTeacher`)
mimari olarak sağlam ve mevcut testlerle kısmen doğrulanmış, ama **uçtan uca, her
API rotası için tek bir otomatik test seti yok**. Genel audit log NO-OP (bkz. bulgu #1).
Export ve silme/anonimleştirme akışı hiç yok. Yedekleme/olay müdahalesi dokümante
değil.

### Etkilenen dosyalar
- Yeni: `prisma/schema.prisma` (`AuditLog` modeli), yeni migration.
- Yeni: `src/lib/audit/log.ts` (genel, kalıcı audit yazıcı — `AiAuditLog` deseninin
  genellemesi), `src/lib/audit/types.ts`.
- Değişecek: `src/lib/auth/audit.ts` (mevcut `auditLog()` imzası korunur ama artık
  gerçekten yazar — geriye dönük uyumlu), her kritik yazma tool'u
  (`src/lib/services/tools.ts`: `createPaymentTool`, `sendParentMessage*`,
  `createFeeRuleTool`/`updateFeeRuleTool`, `confirmMakeupLessonTool`/
  `cancelMakeupLessonTool`, `createStudentTool`/öğrenci güncelleme yolu).
- Yeni: `src/lib/export/institution-export.ts` (tenant-scoped CSV üretimi),
  `src/app/api/v1/export/route.ts` (yeni API), `/panel/kurulum` ekranına export
  butonu.
- Yeni: `src/lib/__tests__/tenant-isolation.test.ts` (kapsamlı, cross-tenant matrix
  testi — mevcut `institution-scope.test.ts`/`write-scope*.test.ts`'in üstüne).
- Yeni: `DEVOPS_GUIDE.md`'ye ek bölüm (yedekleme/geri yükleme/olay müdahalesi —
  mevcut dosya zaten Helios'un sahipliğinde, üzerine yazılıyor, yeni dosya değil).

### Veri modeli değişiklikleri
```prisma
model AuditLog {
  id          String   @id @default(cuid())
  tenantId    String   // Tenant'a @relation YOK — AiAuditLog ile aynı gerekçe:
                        // kurum silinse bile denetim izi sorgulanabilir kalmalı.
  actorUserId String
  actorRole   String
  action      String   // "payment.mark_paid" | "tahsilat.message_sent" |
                        // "teacher_fee.create" | "makeup.decide" | "student.write" | ...
  entityType  String   // "Payment" | "TeacherFeeRule" | "MakeupRequest" | "Student" | ...
  entityId    String
  outcome     String   // "success" | "denied" | "error"
  meta        Json?    // yalnızca meta veri (tutar, eski/yeni durum) — asla ham kişisel içerik
  createdAt   DateTime @default(now())

  @@index([tenantId, action, createdAt])
  @@index([tenantId, entityType, entityId])
}
```
`WorkflowState`'e `tenantId String @default("")` eklenip mevcut tek satırların
`DEFAULT_TENANT_ID`'ye geriye dönük doldurulması (aşağıdaki migration planına bkz.).

### Migration planı ve geçmiş veri korunması
1. `npx prisma migrate dev --name add_audit_log` (yeni migration dosyası;
   `AiAuditLog` emsaliyle aynı desen — additive, hiçbir mevcut sütun/tablo silinmiyor).
2. `AuditLog` boş başlar — geçmişe dönük veri **üretilmez** (geçmiş işlemler için
   audit kaydı yoktu, olamaz da; bu dürüstçe "bu tarihten itibaren" olarak
   dokümante edilir).
3. `WorkflowState.tenantId` eklenirken **NOT NULL DEFAULT ''** ile başlanır, tek
   seferlik bir backfill script'i (`scripts/backfill-workflow-state-tenant.ts`)
   mevcut satırları `DEFAULT_TENANT_ID`'ye yazar, ardından takip migration'ı
   `@@unique([workflowId, tenantId])`'a geçirir. **Bu adım P1 önceliğinde EPIC 0
   içinde ayrı bir alt-görev** — tek-tenant bugünkü üretim verisinde risksiz, ama
   uygulanana kadar workflow tick endpoint'i (`/api/v1/workflows/tick`) tenant'lar
   arası paylaşılan durumla çalışmaya devam ediyor (bkz. Riskler).
4. Rollback: her iki migration da `prisma migrate resolve --rolled-back` ile geri
   alınabilir; `AuditLog` tablosunun silinmesi hiçbir mevcut iş akışını bozmaz
   (yalnızca yeni okuma/yazma yolları buna bağlı).

### API değişiklikleri
- Yeni: `GET /api/v1/export?entities=students,payments,...` (SCHOOL_ADMIN/SUPER_ADMIN,
  `permission: "tenant:all"` DEĞİL — mevcut `tenant:all` SUPER_ADMIN'in TÜM kurumları
  görmesi anlamına geliyor; export için YENİ, dar bir `export:institution` izni
  eklenir ve **her zaman `ctx.tenantId`'ye kapatılır**, SUPER_ADMIN için bile).
- Yeni: `GET /api/v1/audit-log` (SCHOOL_ADMIN/SUPER_ADMIN, tenant-scoped okuma —
  mevcut `AiAuditLog` okuma deseninin genellemesi).
- Mevcut API sözleşmeleri değişmiyor — audit çağrıları var olan tool
  fonksiyonlarının İÇİNE, fire-and-forget olarak eklenir (bkz. `recordAiAuditLog`
  deseni: asla `throw` etmez, kritik yolu asla bloklamaz).

### UI değişiklikleri
- `/panel/kurulum`: yeni "Veri & Güvenlik" bölümü — export butonu (varlık seçimi:
  öğrenciler/veliler/öğretmenler/dersler/yoklama/ödemeler/telafiler), audit log
  görüntüleyici (basit tablo, `/panel/ai/logs` ile aynı görsel dil).
- Boş/yükleniyor/hata/yetkisiz durumları: export butonunun kendisi `SCHOOL_ADMIN`/
  `SUPER_ADMIN` dışında hiç render edilmez (var olan `AiInsightTrigger` gizleme
  desenine paralel — sunucu tarafı da ayrıca reddeder).

### Yetkilendirme
- Export: yeni `export:institution` izni, yalnızca `SCHOOL_ADMIN`/`SUPER_ADMIN`;
  SUPER_ADMIN "tüm kurumlar" seçiliyken **reddedilir** (tek kurum seçilmeli — var
  olan `readScopedData` mutasyon-engelleme desenine paralel).
- Audit log okuma: aynı iki rol, yalnızca `ctx.tenantId`.
- Audit YAZMA: kullanıcı tetiklemez, yalnızca sunucu tarafı tool fonksiyonları
  çağırır — API yüzeyi yok.

### Test planı
- `tenant-isolation.test.ts`: her `/api/v1/*` GET/POST rotası için iki farklı
  tenant'tan kullanıcı ile "karşı tarafın kaydına erişemiyor/değiştiremiyor"
  matrisi (mevcut `institution-scope.test.ts`/`write-scope-api-routes.test.ts`
  üzerine inşa edilir, tekrar yazılmaz).
- `audit-log.test.ts`: her kritik tool çağrısının bir `AuditLog` satırı ürettiğini
  (mock `prisma` ile, `provider-bridge.test.ts`'teki `vi.doMock("../db", ...)`
  deseniyle) doğrular; hata durumunda tool'un yine de başarıyla dönmesi gerektiğini
  (fire-and-forget garantisi) test eder.
- `export.test.ts`: iki kurumluk seed veride, Kurum A'nın export'unun yalnızca
  Kurum A kayıtlarını içerdiğini satır satır doğrular.

### Riskler
- `WorkflowState` tenant-backfill'i uygulanana kadar workflow tick endpoint'i
  hâlâ global — **bu turda yalnızca dokümante ediliyor, düzeltme EPIC 0'ın P1
  alt-görevi olarak ayrı commit'te**, çünkü tek-tenant üretim ortamında pratik
  etkisi düşük ve şemaya dokunmak (unique constraint değişimi) daha dikkatli bir
  migration ister.
- Audit log `STORE_MODE=json/memory`'de sessizce yazılmıyor olacak (bkz. bulgu #3)
  — testler ve demo bunu bilerek kabul ediyor, ama bu prod'da MUTLAKA
  `STORE_MODE=db` gerektirir; `DEVOPS_GUIDE.md`'ye açık uyarı eklenir.

### Geri dönüş planı
Migration'lar additive; `AuditLog` tablosunu/`export` API'sini kaldırmak hiçbir
mevcut ekranı bozmaz. `auditLog()` fonksiyon imzası korunduğu için çağıran
kod hiç değişmeden kalır — geri alma yalnızca `src/lib/auth/audit.ts`'in
implementasyonunu eski NO-OP'a döndürmek.

### Bağımlılıklar
Yok — diğer tüm epic'lerin ÖNÜNDE olmalı çünkü her yeni kritik yazma (EPIC 1, 3, 5,
7, 8) bu audit altyapısını kullanacak.

---

## EPIC 2 — Makbuz sadeleştirme [P1, hızlı iş]

**Durum:** 🟡 Planlandı → uygulanıyor (bu turda)

### Mevcut durum
`src/app/makbuz/[paymentId]/page.tsx` üç bölüm gösteriyor: (1) kurum adı/şube/telefon
başlığı, (2) ödeme detayı, (3) iki imza alanı — "Teslim Alan / Veli İmzası" ve
"Tahsil Eden / Yetkili İmzası". Veri modeli (`src/lib/receipt.ts`,
`buildReceiptViewModel`) zaten `institutionName`/`branchName`/`branchContact`
alanlarını taşıyor ve bunların testleri var (`receipt.test.ts`).

### Etkilenen dosyalar
- Yalnızca `src/app/makbuz/[paymentId]/page.tsx` (JSX). `src/lib/receipt.ts` ve
  testleri **değişmiyor** — view-model hâlâ bu alanları taşıyabilir, sayfa artık
  onları render etmiyor. Bu, en düşük riskli yol: test edilen iş mantığına
  dokunmadan yalnızca sunumu değiştirmek.

### Veri modeli değişiklikleri
Yok.

### Migration planı
Yok — saf UI değişikliği.

### API değişiklikleri
Yok.

### UI değişiklikleri
- Üst başlık bloğu (`model.institutionName`/`branchName`/`branchContact`) kaldırılır;
  yerine yalnızca "Ödeme Makbuzu" + referans no kalır.
- "Teslim Alan / Veli İmzası" imza bloğu tamamen kaldırılır.
- "Tahsil Eden / Yetkili İmzası" bloğu **"Teslim Eden"** olarak yeniden adlandırılır
  ve tek imza alanı olarak kalır.
- Print/PDF görünümü (`@media print` kuralları) aynı kalır — yalnızca içerik azalıyor.

### Yetkilendirme
Değişmiyor (`SCHOOL_ADMIN`/`SUPER_ADMIN`, `canViewReceipt` kuralı aynı).

### Test planı
`receipt.test.ts` değişmeden yeşil kalmalı (regresyon kontrolü). Sayfa için
otomatik test yok (mevcut kod tabanında sayfa-seviyesi Playwright testi yok);
`npm run build` + manuel/`curl` ile render kontrolü yeterli kabul ediliyor.

### Riskler
Yok — saf silme/yeniden adlandırma, veri akışına dokunmuyor.

### Geri dönüş planı
Tek dosyalık `git revert`.

### Bağımlılıklar
Yok.

---

## EPIC 3 — Öğretmen saatlik ücret ve hakediş [P1]

**Durum:** 🟢 Tamamlandı (commit `e7433a6`) — bkz. "Tamamlanan (uygulama özeti)" altında.

### Mevcut durum
`src/lib/teacher-payout.ts` zaten dakika-bazlı, versiyonlu (`effectiveFrom`/
`effectiveTo`), donmuş-snapshot (`TeacherPayout`) bir hakediş motoru içeriyor.
Skor/aralık çakışma doğrulaması (`validateFeeRuleInput`) sağlam. **Saatlik ücret
formülü matematiksel olarak zaten eşdeğer**: `dakika * (saatlikÜcret/60)` =
`dakika * dakikaBaşıÜcret`. Eksik olanlar: (a) UI'da "saatlik" giriş/gösterim,
(b) kesirli süre yuvarlama modu (kurum ayarı), (c) ders tipi (deneme/telafi/
devamsızlık) bazlı açık kural.

### Etkilenen dosyalar
- `prisma/schema.prisma`: `TeacherFeeRule.perMinuteRate` → yanına
  `hourlyRate Float?` eklenir (bkz. aşağıdaki geriye-uyumluluk kararı),
  `School`/`SchoolSettings`'e `feeRoundingMode String @default("exact_minutes")`.
- `src/lib/types.ts`: `TeacherFeeRule`, `SchoolSettings` eşleniği.
- `src/lib/teacher-payout.ts`: `computeTeacherEarningsForPeriod` içine yuvarlama
  modu dalı + ders `type`'a göre açık kural (`trial` → ayrı, sıfır veya özel oran
  uygulanabilir; `makeup`/`regular` aynı oranla sayılır — bu netleştirme ürün
  kararı gerektirir, bkz. Açık kararlar).
- `src/lib/validation.ts`: `createFeeRuleSchema`/`updateFeeRuleSchema` — `hourlyRate`
  girişi kabul edip `perMinuteRate = hourlyRate/60` olarak normalize eden katman.
- UI: `/panel/ucret-kurallari` (mevcut `fee-rule-manager.tsx`) — dakika yerine
  saatlik giriş alanı; `/panel/ogretmenler/[teacherId]/hakedis` — döküm satırlarında
  "uygulanan saatlik ücret" gösterimi.
- Öğretmen kendi özetini görme: `/ogretmen/hakedis` zaten `ctx.teacherId` ile
  kapsanıyor (bkz. mevcut `computeTeacherEarningsForPeriod` çağrı yeri) — ek
  yetki değişikliği gerekmiyor, yalnızca gösterim.

### Veri modeli değişiklikleri (kararlaştırılan yaklaşım)
`perMinuteRate` **kaldırılmaz** (geriye dönük uyumluluk + mevcut testler); yerine
depolama biçimi aynı kalır, yalnızca **giriş/çıkış katmanında** saatlik↔dakika
dönüşümü yapılır (`hourlyRate = perMinuteRate * 60` türetilmiş alan, ya da tam
tersi — şema değişikliği gerekmeyebilir, yalnızca UI + validation katmanı). Şema
değişikliği yalnızca `feeRoundingMode` için gerekli. Bu, "büyük modülü küçük,
test edilebilir adımlara böl" ilkesine uygun en düşük riskli yol.

### Migration planı ve geçmiş veri korunması
- `feeRoundingMode` additive, `DEFAULT "exact_minutes"` (kullanıcının istediği
  varsayılan) — mevcut kurumlar hiçbir davranış değişikliği görmez.
- Var olan `TeacherFeeRule` satırları (dakika-bazlı) **hiç dokunulmadan** kalır;
  yalnızca UI onları saatlik olarak GÖSTERİR (`* 60`). Geçmiş `TeacherPayout`
  snapshot'ları zaten donmuş — bu değişiklikten etkilenmez (kabul kriteri zaten
  sağlanıyor, bkz. bulgu #4).

### API değişiklikleri
`POST /api/v1/...` fee-rule endpoint'i (veya server action) `hourlyRate` alanını
ek olarak kabul eder; `perMinuteRate` da geriye dönük kabul edilmeye devam eder
(iki alandan biri zorunlu). Sözleşme kırılmıyor.

### UI değişiklikleri
- Ücret kuralı formunda "Saatlik ücret (₺)" alanı; kurum ayarında yuvarlama modu
  seçici (gerçek dakika / 30dk yuvarlama / sabit paket).
- Hakediş dökümü satırında: ders tarihi, öğrenci, gerçekleşen süre, uygulanan
  (saatlik) ücret, tutar, durum — bugün zaten `TeacherEarningsLine` bu alanları
  taşıyor, yalnızca gösterim/etiket değişiyor.

### Yetkilendirme
Ücret değiştirme: `SCHOOL_ADMIN`/`SUPER_ADMIN` (mevcut). Öğretmen yalnızca kendi
özetini görür (mevcut, değişmiyor).

### Test planı
- `teacher-payout.test.ts` (mevcut dosya) genişletilir: saatlik→dakika dönüşüm
  round-trip testi, 3 yuvarlama modu için ayrı senaryo, `trial` ders tipi kuralı.
- Regresyon: mevcut tüm `teacher-payout*.test.ts` değişmeden yeşil kalmalı
  (donmuş snapshot davranışı garantisi).

### Riskler
Yuvarlama modu değişikliği geçmişe dönük UYGULANMAMALI — yalnızca yeni
hesaplamalarda etkili; bu netleştirme test ile kilitlenmeli (var olan
`createTeacherPayoutSnapshot`'ın "bir daha hesaplanmaz" garantisiyle tutarlı).

### Geri dönüş planı
Şema değişikliği tek alan (additive) — `prisma migrate resolve --rolled-back`.
UI değişiklikleri dosya bazlı revert.

### Açık kararlar (ürün sahibi onayı gerekli)
- Deneme dersi (`trial`) hakedişte NASIL sayılmalı — tam oran mı, ayrı (daha
  düşük) bir oran mı, hiç mi? Varsayılan öneri: tam oran (bugünkü davranış),
  değişiklik istenirse ayrı bir `TeacherFeeRule.appliesToLessonTypes` alanı
  eklenir (gelecek sprint).

### Bağımlılıklar
EPIC 0 (audit log — ücret değişikliği kritik işlem listesinde).

### Tamamlanan (uygulama özeti — commit `e7433a6`)
- **Şema:** `School.feeRoundingMode String @default("exact_minutes")` eklendi
  (additive, `TeacherFeeRule`/`TeacherPayout` şemaları HİÇ değişmedi —
  `hourlyRate` alanı eklenmedi; plandaki "yalnızca giriş/çıkış katmanında
  dönüşüm" seçeneği izlendi, `perMinuteRate` tek gerçek kaynak kaldı).
- **Hesaplama:** `computeTeacherEarningsForPeriod` içine `payableMinutesFor()`
  yuvarlama dalı eklendi (`exact_minutes`/`round_30`/`fixed_package`).
  `TeacherEarningsLine.durationMinutes` her zaman GERÇEK süreyi taşımaya devam
  eder — yalnızca `amount` yuvarlanmış dakika üzerinden hesaplanır. Ders tipi
  politikası (trial tam oran, cancelled/no_show hariç, Attendance "absent"
  hakedişi etkilemez) kod yorumuyla + testle kilitlendi.
- **Yeni uç:** `updateFeeRoundingModeTool`/`actionUpdateFeeRoundingMode` —
  SCHOOL_ADMIN/SUPER_ADMIN, audit log (`school.fee_rounding_mode.update`).
  Bilinçli olarak AI tool registry'sine eklenmedi (kurum politikası — insan
  kararı, AI'a açılacak bir yüzey değil).
- **UI:** `/panel/ucret-kurallari`'na `FeeRoundingModeSelector` kartı eklendi;
  `fee-rule-manager.tsx` ve `teacher-payout-dashboard.tsx` dakika-başı yerine
  saatlik ücret gösterir/toplar (`hourlyRate = perMinuteRate × 60`, yalnızca
  UI sınırında dönüşüm — depolanan değer değişmedi).
- **Mode parity:** `store.ts`/`store-json.ts`/`store-memory.ts`/`store-db.ts`
  dördünde de `updateFeeRoundingMode` uygulandı; `store-db.ts`'te
  `mapSchoolToAppData` ve `seedDatabase`'e `feeRoundingMode` eşlemesi eklendi.
- **Test:** `teacher-payout.test.ts`'e 3 yuvarlama modu + 3 ders-tipi-politikası
  senaryosu eklendi (round_30 tam dilimde yukarı atlamama dahil); tüm mevcut
  testler (donmuş snapshot garantisi dahil) yeşil kaldı — toplam 551/551.
- **Kapsam dışı bırakılanlar (bilinçli, açıkça raporlanan):** Çalışma
  alanında bu epic'ten TAMAMEN bağımsız, önceki oturumlardan kalma büyük bir
  "kurum seçici / write-scope / audit" altyapısı (`src/lib/institution/`,
  `withAuthContext`'in `actionName` parametresi) ve bir "ders süresi
  standardizasyonu" özelliği (`durationMinutes: 30|40|50`, `lesson-duration.ts`,
  `findPersonScheduleTool`) zaten uncommitted olarak duruyordu. Bunlar EPIC 3
  ile karışmasın diye her tracked dosyada ilgisiz hunk'lar geçici olarak
  çıkarılıp commit'lendi, sonra dosya tam haliyle çalışma alanına geri
  yazıldı (staged içerik ile disk içeriği farklı, bu kasıtlı). `/panel/page.tsx`
  üzerindeki "Öğretmen Hakedişleri" widget'ı ve `teacher-portal-scope.test.ts`
  benzer şekilde dark-mode/institution-scope değişiklikleriyle iç içe geçtiği
  için bu commit'e dahil edilmedi — o dosyalar hâlâ çalışma alanında
  değişikliğe açık duruyor, ileride ilgili epic'lerle birlikte commit'lenmeli.
  `/panel/ucret-kurallari` sayfası ve `/panel/ogretmenler/[teacherId]/hakedis`
  sayfası, henüz commit'lenmemiş `institution/context.ts` ve
  `assistant-page-context.tsx` modüllerine import bağımlıdır — bu nedenle bu
  commit tek başına checkout edilirse derlenmez; doğrulama tam çalışma
  alanına (tüm bekleyen işler birlikte) karşı yapıldı, izole HEAD'e karşı
  değil.

---

## EPIC 4 — Öğrenci türü, kayıt dönemi, eğitim profili [P1]

**Durum:** 🔴 Planlandı (uygulanmadı)

### Mevcut durum
`Student` modelinde/`studentSchema`'da (`src/lib/validation.ts`) yalnızca temel
alanlar var (ad, iletişim, şube, enstrüman, öğretmen, paket, ücret). Öğrenci
türü, kayıt dönemi, seviye, hedef sınav alanları yok.

### Etkilenen dosyalar
- `prisma/schema.prisma`: `Student` modeline `studentType String?`,
  `enrollmentStartDate DateTime?`, `enrollmentEndDate DateTime?`, `level String?`,
  `targetExam String?`, `specialNotes String?` (hepsi **nullable/opsiyonel** —
  geçmiş veri zorunlu backfill istemesin diye).
- `src/lib/types.ts`: `Student` interface'i aynı alanlarla.
- `src/lib/validation.ts`: `studentSchema`'ya `z.enum([...]).optional()` +
  tarih alanları.
- `store-json.ts`/`store-memory.ts`/`store-db.ts`: mapping.
- `src/lib/seed.ts`: örnek öğrencilere tür ataması (demo verisinin anlamlı
  görünmesi için — zorunlu değil ama önerilir).
- UI: `students-table.tsx` (rozet gösterimi), `/panel/ogrenciler` formu (yeni
  alanlar), `/panel/ogrenciler/[id]` detay (varsa) veya öğrenci kartı.
- Öğretmen tarafı: `/ogretmen` sayfasında öğrenci listesinde tür/hedef rozeti.

### Veri modeli değişiklikleri
Yukarıda. `studentType` sabit bir enum yerine **string** tutulur (Prisma'da native
enum yerine) — mevcut kod tabanı `Instrument`/`PaymentStatus` gibi tipleri de
TypeScript-seviyesinde union olarak tutuyor, DB seviyesinde `String` (bkz. şema);
tutarlılık için aynı desen izlenir. Zod şeması sıkı enum uygular.

### Migration planı ve geçmiş veri korunması
Tüm yeni alanlar **nullable** — mevcut öğrenci satırları migration sonrası
`null`/`undefined` değerlerle sorunsuz çalışmaya devam eder. UI, bu alanlar
boşken "Belirtilmemiş" gösterir, hata vermez. Zorunlu backfill YOK.

### API değişiklikleri
`createStudentTool`/öğrenci güncelleme yolu yeni opsiyonel alanları kabul eder.
Sözleşme geriye dönük uyumlu (yeni alanlar olmadan da mevcut istemciler çalışmaya
devam eder).

### UI değişiklikleri
- Öğrenci kartı/rozetinde: tür + ana öğretmen + kayıt durumu (aktif/kayıt bitmiş).
- Form: tür seçici (5 sabit seçenek), kayıt başlangıç/bitiş tarihi, seviye, hedef
  sınav/performans dönemi, özel not (serbest metin).
- Boş durum: yeni alanlar dolu değilse ekranlarda "Belirtilmemiş" — hata değil.

### Yetkilendirme
Mevcut `students:write` (SCHOOL_ADMIN/SUPER_ADMIN) korunuyor. Öğretmen ve veli
yalnızca okuma (mevcut `canAccessStudent` kuralı).

### Test planı
- `validation.test.ts` (veya yeni `student-profile.test.ts`): yeni alanlarla ve
  alanlar olmadan `studentSchema` doğrulaması.
- Mevcut `csv-import-teacher-bug.test.ts` ve öğrenci CRUD testleri değişmeden
  yeşil kalmalı (opsiyonel alan regresyon garantisi).

### Riskler
Düşük — additive/opsiyonel alanlar. Tek risk: içerik hedefleme (müfredat/video)
bu alanlara bağlanacaksa (EPIC 6/7 ile kesişim) enum değerlerinin İLERİDE
değişmesi içerik hedefleme kurallarını kırabilir — bu yüzden enum burada
**sabit, ürün onaylı 5 değer** olarak dondurulmalı.

### Geri dönüş planı
Additive alanlar — kaldırmak mevcut hiçbir sorguyu bozmaz (`SELECT *` yapılmıyor,
Prisma her zaman şema-taslaklı okuyor).

### Bağımlılıklar
Yok (EPIC 0 hariç, genel önkoşul). EPIC 6/7'nin içerik hedefleme mantığı bu
epic'e bağımlı.

---

## EPIC 10 — Telafi merkezi: sebep, AI, SLA, filtreleme [P0]

**Durum:** 🔴 Planlandı (uygulanmadı — önerilen sırada EPIC 0/2/3/4'ten sonra)

### Mevcut durum
`MakeupRequest` zaten `reason` (serbest metin, zorunlu) ve `policyNote` taşıyor.
`src/lib/makeup-engine.ts` slot önerisi/doğrulaması sağlam. **Eksik**: SLA
sayacı/bildirimleri, karar notu ZORUNLULUĞU (bugün yok), karar-veren kaydı,
"bilgi bekleniyor" ara durumu, WhatsApp'tan AI ile neden çıkarımı, filtreleme/arama/
CSV export ekranı.

### Etkilenen dosyalar
- `prisma/schema.prisma`: `MakeupRequest`'e `decisionNote String?`,
  `decidedBy String?`, `decidedAt DateTime?`, `slaDeadline DateTime?`,
  `slaEscalationLevel Int @default(0)` (0=yok, 1=15gün, 2=7gün, 3=3gün, 4=1gün,
  5=aşıldı). `MakeupStatus`'a yeni değer: `"awaiting_info"`.
- `src/lib/types.ts`: eşleniği + `MakeupStatus` union'a `"awaiting_info"` eklenir
  (**geriye dönük uyumlu ekleme** — var olan switch/case ifadeleri
  `exhaustive` kontrolü varsa derleme hatası verir, bu KASITLI: her yeri
  güncellemeyi zorunlu kılar).
- `src/lib/makeup-engine.ts`: SLA hesaplama yardımcıları (`computeSlaDeadline`,
  `resolveSlaEscalationLevel`).
- Yeni: `src/lib/workflows/registry.ts` içine `makeup_sla_check` workflow'u
  (15/7/3/1 gün eşiklerinde bildirim + "SLA aşıldı" durum geçişi).
- UI: `/panel/telafi` — filtre çubuğu (tarih aralığı, öğrenci/veli/öğretmen/şube/
  durum/neden/SLA), sütun genişletme, CSV export butonu, karar notu zorunlu
  modal (onay/iptal/ret akışına eklenir).
- AI: `src/lib/whatsapp/*` inbound mesaj işleme + yeni bir `inferMakeupIntent`
  yardımcı fonksiyonu (mevcut `capabilities.ts`/Tool Registry desenine uygun,
  düşük-güven durumunda `awaiting_info`'ya düşer, ASLA otomatik onaya gitmez).

### Veri modeli değişiklikleri
Yukarıda — tamamı additive/nullable, mevcut telafi kayıtları etkilenmez.

### Migration planı ve geçmiş veri korunması
Yeni alanlar nullable; mevcut açık talepler migration sonrası `slaDeadline: null`
ile başlar — **tek seferlik backfill**: migration sonrası çalışan bir script
(`scripts/backfill-makeup-sla.ts`) yalnızca `status IN (confirmed)` VE
`slaDeadline IS NULL` olan kayıtlara `confirmedLessonId` üzerinden onay tarihini
tahmin edip (yoksa `createdAt + 30 gün` ile) SLA ataması yapar — geçmiş
kayıtların "aniden SLA aşmış" görünmesini engellemek için bu script'in çıktısı
uygulama öncesi ürün sahibiyle gözden geçirilmeli (bkz. Açık kararlar).

### API değişiklikleri
`confirmMakeupLessonTool`/`cancelMakeupLessonTool` girdi şeması `decisionNote`'u
**zorunlu** yapar (breaking — ama yalnızca YENİ çağrılar için; mevcut kayıtlar
etkilenmez). Bu, API sözleşmesinde kasıtlı, dokümante edilmiş bir kırılma —
geriye dönük uyumluluk yerine ürün gereksinimi ("onay/iptal/ret işlemlerinde karar
notu zorunlu olmalı") önceliklendirildi. Yeni: `GET /api/v1/makeup/export`.

### UI değişiklikleri
Genişletilmiş tablo (talep tarihi, öğrenci, veli, ana öğretmen, şube, sebep, karar
notu, karar veren, güncelleme tarihi, SLA/kalan gün), filtre paneli, artan-seviye
SLA rozetleri (yeşil→sarı→turuncu→kırmızı→"aşıldı").

### Yetkilendirme
Karar verme: `SCHOOL_ADMIN`/`SUPER_ADMIN` (mevcut `ADMIN` grubu). Öğretmen: öneri/not
(mevcut `STAFF` grubu, karar YETKİSİ yok — bugün de öyle). Export: aynı EPIC 0
`export:institution` iznine tabi.

### Test planı
- `makeup-sla.test.ts`: 15/7/3/1 gün eşik geçişleri, "aşıldı" durumu, backfill
  script'inin idempotent olduğu (iki kez çalıştırınca aynı sonuç).
- `makeup-decision-note.test.ts`: karar notu olmadan onay/iptal/ret reddedilir.
- Mevcut `makeup-engine.test.ts`, `lesson-*.test.ts` regresyonsuz kalmalı.

### Riskler
SLA backfill'i geçmiş açık taleplerde YANLIŞ "aşıldı" damgası basabilir (onay
tarihi tahmini olduğu için) — bu yüzden backfill **ayrı, geri alınabilir bir
script** olarak yazılıyor, migration'ın kendisine gömülmüyor; ilk çalıştırma
`--dry-run` ile rapor üretir, ikinci çalıştırma onaylı şekilde yazar.

### Geri dönüş planı
Yeni alanlar/status değeri additive. `decisionNote` zorunluluğu geri alınabilir
(zod'da `.optional()`'a döndürmek tek satır).

### Açık kararlar
- SLA backfill'inin geçmiş açık taleplere UYGULANIP UYGULANMAYACAĞI ürün sahibi
  onayı gerektirir — varsayılan öneri: yalnızca migration SONRASI onaylanan
  taleplere SLA başlat, geçmiş açık talepler `slaDeadline: null` (SLA'sız) kalsın.

### Bağımlılıklar
EPIC 0 (audit — telafi kararı kritik işlem listesinde), EPIC 1 ile AI-WhatsApp
neden-çıkarımı altyapısını paylaşır (aynı `capabilities.ts` deseni).

---

## EPIC 1 — Gecikmiş tahsilat WhatsApp + uygulama bildirimi [P0]

**Durum:** 🔴 Planlandı (uygulanmadı)

### Mevcut durum
Bkz. keşif bulgusu #5 — vaka/durum makinesi hazır, otomatik tarama ve bildirim
altyapısı yok.

### Etkilenen dosyalar
- `prisma/schema.prisma`: yeni `Notification` modeli (tenant-scoped, hedef
  `userId`/`studentId`, `kind`, `title`, `body`, `readAt`, `createdAt`).
  `School`'a `collectionsSettings Json?` (mesaj sıklık limiti gün cinsinden,
  tam-otomasyon açık/kapalı). `Student`'a `communicationOptOut Boolean
  @default(false)`.
- `src/lib/types.ts`/store katmanı: eşleniği.
- `src/lib/workflows/registry.ts`: `payment_reminders` workflow'u **yeniden
  yazılır** — sabit demo listesi yerine `data.payments.filter(p =>
  p.status === "overdue" && !student.communicationOptOut)` taraması,
  `upsertFollowUpCase` ile gerçek vaka oluşturma/güncelleme, sıklık limiti
  kontrolü (`lastContactAt` + kurum ayarı).
- Yeni: `src/lib/notifications/*` (oluşturma, tenant-scoped okuma, okundu
  işaretleme — `AiAuditLog`/`tahsilat/cases.ts` json+db parity deseniyle).
- UI: `/veli` portalına bildirim rozeti/listesi, `/panel/kurulum`'a "Tahsilat
  Otomasyonu" ayar bölümü (sıklık limiti, tam-otomasyon toggle — varsayılan
  KAPALI/onaylı gönderim), `TahsilatQueue`'ya opt-out göstergesi.
- ROI: `getCollectionRoi` genişletilir — `sentThisMonth`, `respondedThisMonth`
  eklenir (mevcut alanlar korunur, additive).

### Veri modeli değişiklikleri
Yukarıda — tamamı yeni tablo/opsiyonel alan, geçmiş veri N/A.

### Migration planı ve geçmiş veri korunması
Additive. `communicationOptOut` tüm mevcut öğrenciler için `false` (varsayılan) —
davranış değişikliği yok, kimse "yanlışlıkla" opt-out olmaz.

### API değişiklikleri
Yeni: `GET/POST /api/v1/notifications` (okuma + okundu-işaretleme, PARENT/
TEACHER/STUDENT kendi bildirimleri), `PATCH /api/v1/students/[id]/communication-preference`
(opt-out — PARENT kendi çocuğu için, SCHOOL_ADMIN herkes için). Mevcut
`/api/ai/collections*` sözleşmesi değişmiyor.

### UI değişiklikleri
- Veli portalı: bildirim listesi/rozeti (okunmamış sayısı).
- Kurulum: sıklık limiti (gün), tam-otomasyon toggle (varsayılan kapalı — "yönetici
  onaylı" açıklaması net gösterilir).
- Tahsilat kuyruğu: opt-out olan öğrenciler için "İletişim reddi" rozeti, yeni
  mesaj oluşturma engellenir (buton devre dışı, sebep tooltip'te).

### Yetkilendirme
Bildirim okuma: yalnızca hedeflenen kullanıcı (`ctx.userId`/`ctx.studentId`
eşleşmesi). Otomasyon ayarı: `SCHOOL_ADMIN`/`SUPER_ADMIN`. Opt-out: PARENT kendi
çocuğu, admin herkes.

### Test planı
- `payment-reminders-workflow.test.ts`: gerçek tarama mantığı (opt-out'lu öğrenci
  atlanır, sıklık limiti içindeyse atlanır, ödeme `paid` olunca vaka kapanır —
  `markPaymentCasesPaid` regresyonu).
- `notifications.test.ts`: tenant-scoped okuma, başka kullanıcının bildirimine
  erişilemediği.
- Mevcut `tahsilat-roi.test.ts`, `collections-ai-routes.test.ts` regresyonsuz.

### Riskler
Gerçek "teslim edildi/okundu" durumu yalnızca gerçek WhatsApp transport'u
(Meta/Twilio) bağlıysa mümkün (bkz. bulgu #6) — `wa.me` linkiyle yalnızca
"gönderildi" (admin onayladı) ve "yanıt geldi" (webhook inbound eşleşmesi,
zaten var) izlenebilir; "delivered" durumu bu turda **UI'da gösterilmez**, yalnızca
transport gerçek bir sağlayıcıya bağlandığında aktif olur (kod hazır, veri yoksa
alan boş kalır).

### Geri dönüş planı
Yeni tablolar/alanlar additive; workflow'un eski (demo) davranışına dönmek tek
dosya revert.

### Bağımlılıklar
EPIC 0 (audit + export), mevcut tahsilat altyapısı (zaten var).

---

## EPIC 5 — Duyuru merkezi [P1]

**Durum:** 🔴 Planlandı (uygulanmadı)

### Mevcut durum
Hiç yok.

### Etkilenen dosyalar
- `prisma/schema.prisma`: yeni `Announcement` modeli (tenant-scoped, `title`,
  `body`, `attachmentUrl?`, `audienceType` [`all|branch|teachers|parents|
  students|studentType|selected`], `audienceRef Json?` [şube id / studentType /
  seçili kullanıcı id listesi], `status` [`draft|published|archived`], `pinned
  Boolean`, `publishAt`, `expireAt`, `createdBy`), `AnnouncementRead` (okuma
  takibi — `announcementId`+`userId` unique).
- `src/lib/announcements/*` (yeni servis katmanı, tool registry'ye
  `createAnnouncementTool`/`listAnnouncementsForUserTool` eklenir).
- UI: `/panel/duyurular` (yeni ekran — oluşturma/yönetim), veli/öğretmen/öğrenci
  portallarına duyuru listesi widget'ı, kritik duyuru için EPIC 1'in
  `Notification` altyapısı yeniden kullanılır (yeni bildirim türü değil).

### Veri modeli değişiklikleri
Yukarıda — tamamen yeni, geçmiş veri N/A.

### Migration planı
Additive, tek seferlik yeni tablo migration'ı.

### API değişiklikleri
Yeni: `POST/GET /api/v1/announcements`, `POST /api/v1/announcements/[id]/read`.

### UI değişiklikleri
Yönetici: oluşturma formu (başlık/içerik/görsel/hedef kitle/yayın penceresi/
sabitleme), okunma durumu tablosu. Portal tarafı: hedef kitleye göre FİLTRELENMİŞ
liste (**sunucu tarafında filtrelenir, asla client'a hedef-dışı veri
gönderilmez** — güvenlik kuralı).

### Yetkilendirme
Oluşturma: `SCHOOL_ADMIN`/`SUPER_ADMIN`. Okuma: hedef kitle eşleşmesi sunucu
tarafında (`listAnnouncementsForUserTool` içinde `ctx.role`/`ctx.teacherId`/
`ctx.studentId`/öğrenci türü karşılaştırması) — asla client-side filtre değil.

### Test planı
`announcements-audience.test.ts`: her `audienceType` için "hedefte olan görür,
olmayan görmez" matrisi (özellikle `studentType` ve `selected` kullanıcı hedefleme
— en hataya açık olanlar).

### Riskler
Hedef kitle mantığının yanlış uygulanması = özel duyurunun yanlış kişiye sızması.
Bu yüzden test planı özellikle bu senaryoya odaklanıyor; kod review'da (Sentinel
adımı) bu epic'in "Yetkisiz kullanıcı hedef dışı duyuruyu göremez" kabul kriteri
ayrıca doğrulanmalı.

### Geri dönüş planı
Yeni tablolar — kaldırmak mevcut hiçbir ekranı bozmaz.

### Bağımlılıklar
EPIC 4 (studentType hedeflemesi için), EPIC 1 (bildirim altyapısı paylaşımı).

---

## EPIC 7 — Öğretmen gelişim değerlendirme formu + PDF [P1/P2]

**Durum:** 🔴 Planlandı (uygulanmadı)

### Mevcut durum
Hiç yok. `src/lib/receipt.ts`'in "view-model + PDF/print sayfası" deseni
doğrudan referans alınacak.

### Etkilenen dosyalar
- `prisma/schema.prisma`: yeni `LessonAssessment` modeli (tenant-scoped,
  `lessonId`, `studentId`, `teacherId`, A–E bölümlerinin her maddesi için
  `Int` (1–5) alanlar — JSON yerine **düz sütunlar**, çünkü "trend ve
  raporlama için 1–5 puan altyapısı tercih edilsin" isteği SQL agregasyonunu
  gerektiriyor; JSON içinde trend hesaplamak hem yavaş hem kırılgan olur),
  `strengthNote`, `nextStepsNote`, `improvementNote`, `parentPrivateNote`,
  `parentNoteVisibleToStudent Boolean @default(false)`, `teacherSignedName`,
  `teacherSignedAt`.
- `src/lib/assessment/*` (skor hesaplama, 4-haftalık toplama/trend).
- `src/app/degerlendirme/[assessmentId]/page.tsx` (yeni, `makbuz` sayfasıyla
  AYNI PDF/print desenini izler).
- `src/app/degerlendirme/rapor/[studentId]/page.tsx` (4 haftalık birleşik rapor).
- UI: `/ogretmen` portalına değerlendirme formu (yalnızca kendi öğrencisi için).

### Veri modeli değişiklikleri
Yukarıda — tamamen yeni.

### Migration planı
Additive, geçmiş veri N/A.

### API değişiklikleri
Yeni: `POST /api/v1/assessments`, `GET /api/v1/assessments/[studentId]`,
`GET /api/v1/assessments/[studentId]/report` (4 haftalık birleşik).

### UI değişiklikleri
Form: A–E bölümleri (her madde 1–5 puan, `Slider`/`Select` — mevcut `ui.tsx`
primitiflerinin üzerine), öğretmen dijital onay (ad-soyad + tarih, `teacherSignedAt`
sunucu saatiyle damgalanır, client'tan gelen tarihe güvenilmez). PDF/print sayfası
makbuz deseniyle aynı (`@media print`).

### Yetkilendirme
Oluşturma: `TEACHER`, **yalnızca kendi öğrencisi** (`student.teacherId ===
ctx.teacherId` kontrolü — `canAccessStudent`'a ek, daha dar bir kural, çünkü
mevcut `canAccessStudent` TEACHER için "true, filtrelenir" diyor; bu epic o
filtrelemeyi somut olarak uygular). `parentPrivateNote`: PARENT/SCHOOL_ADMIN
görür, STUDENT görmez (varsayılan) — `parentNoteVisibleToStudent` alanı bunu
öğretmenin isteğine göre açar.

### Test planı
`assessment-visibility.test.ts`: `parentPrivateNote`'un STUDENT'a
`parentNoteVisibleToStudent=false` iken hiç dönmediğini (API seviyesinde,
UI-gizleme değil), öğretmenin başka öğretmenin öğrencisi için değerlendirme
oluşturamadığını doğrular.

### Riskler
Veliye özel notun yanlışlıkla öğrenciye sızması — API seviyesinde alan tamamen
response'tan ÇIKARILARAK (yalnızca UI'da gizlenerek değil) engellenir.

### Geri dönüş planı
Yeni tablo — additive.

### Bağımlılıklar
EPIC 0 (audit — "gelişim raporu" kritik işlem listesinde), EPIC 6 (portal UI'ları
bu formu/raporu gösterecek yer).

---

## EPIC 6 — Öğrenci, veli, öğretmen portalı [P1/P2]

**Durum:** 🔴 Planlandı (uygulanmadı — en büyük, en riskli epic)

### Mevcut durum
`/veli` bugün TEK, sabit bir "veli" deneyimi (`session.studentId` ile
kapsanıyor). Ayrı bir öğrenci deneyimi/rolü yok (bkz. bulgu #7).

### Etkilenen dosyalar (özet — bu epic kendi içinde alt-planlanmalı)
1. **RBAC genişletmesi**: `src/lib/auth/types.ts` (`APP_ROLES`'a `STUDENT`
   eklenir), `src/lib/auth/rbac.ts` (yeni rol için izin seti), `middleware.ts`
   (yeni `/ogrenci` route guard'ı), tüm tool registry `requiredRoles`
   listelerinin GÖZDEN GEÇİRİLMESİ (yeni rolün nereye erişebileceği).
2. **Yeni portal**: `/ogrenci` (bugünkü `/veli`'nin YANINA, ONUN YERİNE değil —
   `/veli` KALIR, PARENT rolü için).
3. **Ödev/materyal modeli**: yeni `Homework` (öğretmen atar), `HomeworkSubmission`
   (öğrenci yükler — dosya/video/foto), `TeachingMaterial` (öğretmen pratik
   videosu/materyal yükler, EPIC 4'ün `studentType`/enstrüman/seviye alanlarına
   hedeflenir).
4. **Dosya depolama**: EPIC 0'ın "yetkili, süreli URL" gereksinimiyle BİRLİKTE
   çözülmeli — bkz. aşağıdaki "Dosya/video erişimi" alt-bölümü.
5. **Memnuniyet/geri bildirim formu**: yeni `TeacherFeedback` modeli
   (yapılandırılmış, moderasyonlu — kamuya açık ortalama/sıralama YOK, yalnızca
   SCHOOL_ADMIN görür).
6. **Çocuk hesabı yaş/onay politikası**: kod değişikliği değil, üründe kayıt
   akışına eklenen bir onay adımı (bkz. Açık kararlar).

### Dosya/video erişimi — yaklaşım
Bu proje bugün harici bir obje depolama (S3/R2/Blob) kullanmıyor. Yeni bağımlılık
eklemeden önce (kural #8) iki seçenek var:
- **(A) Öneri:** mevcut Next.js API route'ları üzerinden, DB'de saklanan
  (küçük dosyalar) veya `/tmp`+önceden imzalı, KISA ÖMÜRLÜ (ör. 5 dk) bir
  `GET /api/v1/files/[token]` rotası — token, dosya id + `expiresAt` + HMAC imza
  içerir (mevcut `jose`/JWT altyapısıyla aynı kütüphane, yeni bağımlılık yok).
  Tahmin edilemez, süreli, yetki kontrollü. Video gibi büyük dosyalar için bu
  yaklaşım Vercel'in response boyutu/süresi sınırlarına takılabilir.
- **(B) Gerçek üretim ölçeği için:** S3-uyumlu obje depolama (R2/S3) + imzalı URL
  — bu YENİ bir bağımlılık (`@aws-sdk/client-s3` veya benzeri) gerektirir; bu
  turda YAZILMAZ, yalnızca gerekçesiyle burada planlanır: "dosya/video hacmi
  büyüdükçe DB/`/tmp` tabanlı çözüm ölçeklenmez."
- **Karar:** İlk sürüm (A) ile başlar (küçük dosya/foto + kısa video), (B) ayrı,
  onaylı bir sonraki sprint. Bu, kuralın "altyapı sınırları varsa planla" maddesine
  uygun.

### Gizlilik kararı (öğretmen puanlama)
Kamuya açık ortalama/sıralama **YAPILMAZ**. `TeacherFeedback`: veli/öğrenci
yapılandırılmış form doldurur (madde bazlı, EPIC 7'nin A–E desenine benzer),
yalnızca `SCHOOL_ADMIN`/`SUPER_ADMIN` görür, moderasyon alanı (`status:
pending|reviewed|actioned`) taşır. Öğretmen kendi ortalamasını GÖRMEZ (ilk
sürüm) — kötüye kullanım riskini azaltmak için bilinçli kısıtlama.

### Test planı (bu epic için özellikle kritik)
- `rbac-student-role.test.ts`: yeni STUDENT rolünün tool registry'de doğru
  kısıtlandığı (yazma yapamadığı, yalnızca kendi verisini okuduğu).
- `homework-visibility.test.ts`, `teacher-feedback-privacy.test.ts`
  (feedback'in öğretmene/kamuya asla sızmadığı).
- `file-access-token.test.ts`: süresi dolmuş/yanlış kullanıcıya ait token'ın
  reddedildiği.

### Riskler
En yüksek riskli epic — yeni rol (RBAC yüzeyinin tamamını etkiler), dosya erişimi
(güvenlik-kritik), çocuk verisi (KVKK-hassas). **Küçük, ayrı commit'lere
bölünmeden yapılmamalı**: (1) STUDENT rolü + boş `/ogrenci` iskelet,
(2) ödev modeli + öğretmen atama, (3) öğrenci yükleme + dosya erişim token'ı,
(4) veli portalı genişletmesi (gelişim özeti/PDF/ödeme bildirimleri), (5)
memnuniyet formu — her biri ayrı PR/rapor.

### Geri dönüş planı
STUDENT rolü eklemek additive (mevcut 5 rol davranışı değişmez). Her alt-adım
kendi tablosuyla additive.

### Açık kararlar
- Çocuk hesabı yaş eşiği (örn. 13 altı yalnızca veli hesabı; üstü öğrenci hesabı
  + veli gözetimi) — ürün/hukuk onayı gerekli, bu turda YALNIZCA karar listesine
  eklendi, varsayılan: küçük yaş grubunda yalnızca veli hesabı.

### Bağımlılıklar
EPIC 4 (içerik hedefleme), EPIC 7 (gelişim raporu — portallarda gösterilecek),
EPIC 0 (dosya erişim güvenliği), EPIC 5 (duyurular portallarda gösterilecek).

---

## EPIC 8 — Ders başlat/bitiş, sayaç, canlı durum [P2]

**Durum:** 🔴 Planlandı (uygulanmadı)

### Mevcut durum
`Lesson.status`: `scheduled|completed|cancelled|no_show` — gerçek başlangıç/bitiş
zaman damgası yok, yalnızca planlanan `startAt`/`endAt` var.

### Etkilenen dosyalar
- `prisma/schema.prisma`: `Lesson`'a `actualStartAt DateTime?`,
  `actualEndAt DateTime?`, `startCorrectedBy String?`, `startCorrectionNote
  String?` (+ bitiş için aynısı), yeni `status` değeri `"in_progress"`.
- `src/lib/lesson-live-status.ts` (yeni — planlandı/başladı/devam ediyor/
  tamamlandı/gecikmiş hesaplama, saf fonksiyon).
- UI: `/ogretmen` "Dersi başlat"/"Dersi bitir" butonları, `/veli`+`/ogrenci`
  canlı durum rozeti (polling veya mevcut altyapıda SSE yok — basit polling
  ile başlanır, WebSocket YENİ bağımlılık gerektirir, bu turda yazılmaz).

### Migration planı
Additive/nullable — geçmiş dersler `actualStartAt/EndAt: null` kalır, "canlı
durum" hesaplaması yalnızca bu alanlar doluysa devreye girer.

### Yetkilendirme
Başlat/bitir: `TEACHER`, yalnızca kendi dersi. Düzeltme: `SCHOOL_ADMIN`/
`SUPER_ADMIN`, `startCorrectionNote` ZORUNLU + audit log (EPIC 0).

### Test planı
`lesson-live-status.test.ts`: durum geçişleri, erken/geç başlatma toleransı,
yönetici düzeltmesinin not olmadan reddedildiği.

### Riskler
Bağlantı kopması/offline senaryosu bu sürümde ÇÖZÜLMEZ — kullanıcıya UI'da açıkça
belirtilir ("İnternet bağlantınız kesilirse dersi bitirmeyi unutmayın" tipi
uyarı); offline kuyruk/senkron ayrı, ileri bir keşif görevi.

### Geri dönüş planı
Additive alanlar/status değeri.

### Bağımlılıklar
EPIC 0 (düzeltme audit'i), yoklama/hakediş akışlarıyla tutarlılık (EPIC 3 ile
veri kesişimi: `actualEndAt - actualStartAt` ileride hakediş süresi kaynağı
olabilir mi — bu turda HAYIR, hakediş yine planlanan `startAt/endAt` süresini
kullanmaya devam eder; değişikliği ayrı bir ürün kararı gerektirir).

---

## EPIC 9 — Öğretmen müsaitlik ve yönetici onayı [P2]

**Durum:** 🔴 Planlandı (uygulanmadı)

### Mevcut durum
`Teacher.availability` (Json) doğrudan CANLI müsaitlik — onay akışı yok,
öğretmen kendi programını anında değiştirebiliyor (var olan davranış).

### Etkilenen dosyalar
- `prisma/schema.prisma`: yeni `TeacherAvailabilityRequest` modeli (`teacherId`,
  `proposedAvailability Json`, `exceptions Json?`, `status:
  pending|approved|rejected`, `reviewNote?`, `reviewedBy?`, `reviewedAt?`).
- `src/lib/teacher-availability.ts` (öneri oluşturma, onay/ret, onaylananın
  `Teacher.availability`'ye UYGULANMASI).
- UI: `/ogretmen` müsaitlik düzenleme formu ("onay bekliyor" rozetiyle),
  `/panel/ogretmenler/[id]` yönetici onay ekranı (güncel/bekleyen/çakışma
  gösterimi).

### Migration planı
Additive yeni tablo — mevcut `Teacher.availability` alanı DEĞİŞMEZ, yalnızca
YAZMA yolu değişir (artık doğrudan değil, onay üzerinden).

### Yetkilendirme
Öneri oluşturma: `TEACHER` (kendi). Onay: `SCHOOL_ADMIN`/`SUPER_ADMIN`.

### Test planı
`teacher-availability-approval.test.ts`: öğretmenin kendi canlı programını
DOĞRUDAN değiştiremediği (yalnızca öneri oluşturabildiği), onaylanan önerinin
programlama motorunda (`makeup-engine.ts`/`lesson-scheduling.ts`) kullanıldığı.

### Riskler
Mevcut akışlarda (`teacherSchema` güncelleme, CSV import) `availability` alanının
DOĞRUDAN yazıldığı yerler varsa (örn. `actionAddTeacher`/CSV import) bu epic
onlarla ÇAKIŞIR — implementasyon öncesi bu yazma yolları taranıp ya bu akışın
İÇİNE alınmalı ya da "ilk kayıt anında doğrudan, sonrası onaylı" kuralı net
şekilde kodlanmalı (bkz. Açık kararlar).

### Geri dönüş planı
Additive tablo; onay zorunluluğu geri alınabilir (eski doğrudan-yazma yoluna
dönmek tek fonksiyon değişikliği).

### Açık kararlar
İlk öğretmen kaydı sırasındaki müsaitlik girişi de onay mı bekleyecek, yoksa
yalnızca SONRAKİ değişiklikler mi? Öneri: ilk kayıt (admin zaten oluşturuyor)
doğrudan, yalnızca öğretmenin KENDİ yaptığı sonraki değişiklikler onaya girer.

### Bağımlılıklar
EPIC 0 (audit).

---

## Uygulama sırası (onaylanan, keşif sonrası küçük netleştirmelerle)

1. **EPIC 0** — güvenlik/tenant/audit temeli (bu turda uygulanıyor)
2. **EPIC 2** — makbuz sadeleştirme (bu turda uygulanıyor, hızlı kazanım)
3. **EPIC 3** — saatlik ücret (backend zaten hazır, düşük risk)
4. **EPIC 4** — öğrenci türü/kayıt dönemi (additive, düşük risk)
5. **EPIC 10** — telafi sebep/filtre/SLA
6. **EPIC 1** — tahsilat otomasyonu + bildirim
7. **EPIC 5** — duyuru merkezi
8. **EPIC 7** — gelişim formu + PDF
9. **EPIC 6** — öğrenci/veli/öğretmen portalı (en büyük, en son — 4/5/7'ye bağımlı)
10. **EPIC 8** — ders başlat/bitiş
11. **EPIC 9** — öğretmen müsaitlik/onay
12. Export/yedekleme/geri yükleme tatbikatının tamamlanması (EPIC 0'ın son
    alt-adımı, diğer epic'lerin ürettiği yeni varlıkları export'a dahil ederek)

Kart/RFID (EPIC 8'de bahsedilen) bu plana HİÇ dahil edilmedi — kullanıcının
talimatı gereği ayrı, uzun vadeli bir keşif görevi olarak `PRODUCT_ROADMAP.md`'ye
not düşülecek, bu sprint kapsamında değil.

## Bu turda gerçekleşen kapsam

Bu oturumda **EPIC 0** ve **EPIC 2** uygulanıyor (P0 + hızlı-kazanım P1).
EPIC 3/4/10/1/5/7/6/8/9 yukarıda tam planlanmış durumda ama kod olarak
YAZILMADI — kapsamları gerçekten büyük (her biri en az 1 yeni Prisma modeli +
5-10 dosya + yeni ekran) ve kullanıcının kendi talimatındaki "küçük, tamamlanan,
test edilen commit'lere böl" ilkesiyle tek oturumda hepsini üstünkörü yazmak
çelişir. Sonraki oturumlarda bu plan sırasıyla, her epic kendi doğrulama
turuyla (typecheck/lint/test/build + epic raporu) uygulanacak.
