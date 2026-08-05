
## Session — PRODUCT_BACKLOG implementation (partial)

Onaylı `PRODUCT_BACKLOG.md` eklendi. Uygulanan:
- PII: AES-GCM T.C. şifreleme/maskeleme/reveal audit + `pii:full`
- Öğrenci seviye kuralları MEB 1–8 / LCM opsiyonel
- Tahsilat vade pencereleri + MEB VakıfBank / diğer Halkbank IBAN seçimi
- Pazartesi + kapalı gün helpers; takvim 10:00 sabiti
- Deneme dersi model/API/UI (`/panel/deneme`)
- Evraklar Faz 1: şablon, otomatik alan, referans, oluştur/yazdır (`/panel/evraklar`)
- Soft archive API (`/api/v1/students/:id/archive`)
- Prisma migration `20260805190000_product_backlog_core`

**Notion:** MCP Notion bağlantısı yok — iş/UAT kayıtları bu dosya + PRODUCT_BACKLOG §9 ile izlenir.

Açık: tam form UX, liste filtreleri, yoklama UI durumları, Evraklar Faz 2, dini tatiller, hakediş enstrüman sütunu, store-db alan mapping parity (JSON patch path mevcut).

# WORK_PROGRESS.md

Çalışan plan — canonical dokümanların (`PRODUCT_REQUIREMENTS.md`, `PRODUCTION_AUDIT.md`,
`DATABASE_ARCHITECTURE.md`) **yanında** tutulur, onların yerine geçmez. Onlarla
çelişen bir madde bulunursa canonical doküman geçerlidir.


## Session — Production hardening (RBAC + curriculum)

- TEACHER öğrenci erişimi fail-closed (`assertStudentAccess` + tool wiring).
- `StudentCurriculumTopic` model (DB migration + JSON), tools, API, export.
- UI: öğretmen çalışma alanı + `/ogrenci/mufredat` + `/veli/mufredat`.
- Admin: `/panel/ders-duzeltme` (correctLessonTimes).
- Sidebar: yalnızca izole link ekleri; kirli sidebar redesign commit edilmedi.

## Session — Öğretmen öğrenci çalışma alanı (portal birleşimi)

Öğretmen ana ekranından kendi öğrencilerine `/ogretmen/ogrenciler/[studentId]`
çalışma alanı. Genel bakış, dersler, ödev (oluştur/incele), materyal/müfredat
özeti, EPIC 7 gelişim formu + geçmiş. Ders başlat/bitir ana ekran bugünkü
kartlarda ve çalışma alanı yaklaşan derslerde.

- **Scope helpers:** `findOwnStudent` / `ownStudents` / `ownStudentLessons` /
  `ownWeekLessons` (`teacher-portal-scope.ts`) + unit testler.
- **Güvenlik:** cross-teacher URL → bulunamadı; tool katmanı ödev/değerlendirme/
  materyal okumalarında zaten sahiplik zorlar.
- **Gelişim formu:** mevcut `LessonAssessmentForm` (EPIC 7) — yeni model yok.
- **Canlı ders UI:** `LessonLiveActions` double-click guard + loading/error retry.
- **Dokunulmayan:** kirli ağaçtaki AI/panel/sidebar ve diğer ilgisiz dosyalar.

## Güncel Durum — AI Runtime (provider sırası / modeller / env)

Bu bölüm HER ZAMAN güncel tutulur. Aşağıdaki session kayıtları (en yeniden en
eskiye) o session'ın YAZILDIĞI ANDAKİ durumu yansıtır — farklı bir provider
sırası/model adı geçiyorsa tarihsel kayıttır; bugünkü gerçek runtime davranışı
için bu blok geçerlidir.

**Auto mode provider sırası** (`src/lib/ai/provider-chain.ts`'teki
`PROVIDER_CHAIN`; hem `provider-bridge.ts`'in capability-zinciri hem
`config.ts`'teki `getProviderConfig()` — chat orchestrator'ın TEK-provider
seçimi — AYNI bu sırayı izler):

| # | Provider | Model (varsayılan) | Gerekli env |
|---|---|---|---|
| 1 | Gemini | `gemini-2.5-flash` | `GEMINI_API_KEY` (veya `GOOGLE_API_KEY`) |
| 2 | Groq Cloud | `llama-4-scout-17b` | `GROQ_API_KEY` |
| 3 | NVIDIA NIM | `nemotron-3-ultra-550b-a55b` | `NVIDIA_NIM_API_KEY` |
| 4 | Cerebras Cloud | `gpt-oss-120b` | `CEREBRAS_API_KEY` |
| 5 | Heuristic | — (kural tabanlı, LLM yok) | yok — her zaman configured, zincirin sonu |

- Eksik VEYA boşluktan ibaret bir anahtar **eksik** sayılır, zincir bir sonraki
  provider'a geçer (`config.ts`'teki `hasValue()`).
- Bir provider **auth/anahtar hatası** (401/403, "invalid api key" vb.)
  verirse bir daha DENENMEZ — ne kendi iç retry'ı (`retry.ts`'teki
  `shouldRetry` + `config.ts`'teki `isAuthConfigError`) ne de zincir onu
  tekrar dener; doğrudan sıradaki provider'a geçilir. Rate limit/timeout/
  5xx/malformed response/desteklenmeyen model dahil DİĞER TÜM hatalar da
  fallback nedenidir (`provider-bridge.ts`'teki blanket `catch`).
- `AI_PROVIDER=<isim>` ile açıkça bir provider seçilebilir (`auto` dışı):
  `gemini` | `groq` | `nvidiaNim` | `cerebras` | `heuristic` | `openai` |
  `grok` | `local`. Son üçü (`openai`/`grok`/`local`) yalnızca EXPLICIT
  seçimde çalışır — auto zincirinin bir parçası DEĞİL.
- `cloudflareAi` hâlâ tam implemente (`providers/cloudflare-workers-ai.ts`,
  `resolveChainProviderConfig`/`resolveLiveProvider`) ama auto zincirinin
  ÜYESİ DEĞİL — heuristic'ten sonra bir adım kalmadığı için sıralamada yeri
  yok; yalnızca doğrudan `resolveLiveProvider("cloudflareAi")` ile kullanılır.
- Env değişken/model adı override'ları ve tam liste: proje kökündeki
  `.env.example` (gerçek değer İÇERMEZ — `.env`/`.env.local` yerel/gitignored).
- Etkilenmeyen alanlar: Gemini tool-calling şema sanitizasyonu, tenant
  isolation, approval akışı, audit trail, streaming — bunlar bu sıralamadan
  bağımsız, değişmedi.

## Session — Provider sırası finalize: Gemini → Groq → NVIDIA NIM → Cerebras → Heuristic + auth-retry düzeltmesi

Önceki "Real Multi-Provider Runtime" sprintinin zincirini (Gemini → Groq →
Cerebras → NVIDIA NIM → Cloudflare → Heuristic) YENİ, kesinleşmiş sıraya
taşıdı: **Gemini → Groq → NVIDIA NIM → Cerebras → Heuristic** (bkz. yukarıdaki
"Güncel Durum" bölümü — tam tablo/env listesi orada). Model adları
güncellendi ve gerçek bir auth-retry hatası bu sprintte düzeltildi.

- **`provider-chain.ts`**: `PROVIDER_CHAIN` yeniden sıralandı, `cloudflareAi`
  ÇIKARILDI (heuristic'ten sonra bir adım kalmıyor, sıralamada yeri yok) —
  ama `resolveChainProviderConfig`/`resolveLiveProvider`/adapter'ı hâlâ tam
  çalışır durumda, yalnızca auto zincirinin dışında.
- **`config.ts`**: `getProviderConfig()` (chat orchestrator'ın TEK-provider
  seçimi — "Real Multi-Provider Runtime" sprintinde BİLİNÇLİ OLARAK zincire
  bağlanmamıştı) artık groq/nvidiaNim/cerebras'ı da tanıyor ve AYNI
  Gemini→Groq→NVIDIA NIM→Cerebras→heuristic sırasını izliyor — "hangi
  modelsin" (`describeIdentity()`) ve capability-zinciri artık TUTARLI. Yeni
  `hasValue()` — boşluktan ibaret bir env değeri de eksik sayılıyor (önceden
  yalnızca `undefined`/`""` kontrol ediliyordu). `AI_PROVIDER=nvidianim`
  (küçük harf) artık doğru eşleşiyor (case-insensitive normalize — tek
  mixed-case provider adı olduğu için özel durum). Model varsayılanları
  güncellendi: `gemini-2.5-flash` / `llama-4-scout-17b` /
  `nemotron-3-ultra-550b-a55b` / `gpt-oss-120b`.
- **Gerçek bug düzeltmesi — auth hatası sonrası retry**: `config.ts`'teki
  `isAuthConfigError()` tanımlıydı ama HİÇBİR YERDE çağrılmıyordu — geçersiz
  bir anahtar aynı provider'a `AI_RETRY_COUNT` kadar (varsayılan 2) daha
  boşuna deneniyordu. `retry.ts`'e `shouldRetry` opsiyonu eklendi;
  `providers/openai-compatible.ts` + `providers/cloudflare-workers-ai.ts`
  artık `isAuthConfigError`'ı `shouldRetry` olarak geçiyor — auth/anahtar
  hatasında SIFIR ek deneme, geçici hatalarda (5xx/timeout) retry aynen
  çalışmaya devam ediyor.
- **`provider-factory.ts`**: `getLlmProvider()` (TEK-provider resolver)
  groq/cerebras/nvidiaNim için de `openai-compatible.ts` adaptörüne çözüyor.
- **`response-shaping.ts`**: `describeIdentity()`'nin provider etiketleri
  (Groq Cloud/NVIDIA NIM/Cerebras) ve "hiçbir anahtar yok" mesajındaki env
  değişkeni listesi güncellendi (`OPENAI_API_KEY`/`GROK_API_KEY`/... yerine
  artık gerçekten kontrol edilen `GEMINI_API_KEY`/`GROQ_API_KEY`/
  `NVIDIA_NIM_API_KEY`/`CEREBRAS_API_KEY`).
- **Yeni `.env.example`** (proje kökü) — final sıra/model adları + hangi env
  değişkenlerinin gerekli olduğu, gerçek değer YOK.
- **Dokunulmayan alanlar**: `gemini.ts` (schema sanitization),
  `plan-invocation.ts`/`capabilities.ts` (tenant isolation/approval/
  `preferredProvider` eşlemeleri), `provider-bridge.ts`'in audit çağrıları,
  `orchestrator.ts`'in streaming akışı, `.env`/`.env.local` (zaten doğru
  yapılandırılmıştı, gerçek değerlere DOKUNULMADI).

Testler (yeni/güncellenen): `provider-chain-runtime.test.ts` (`PROVIDER_CHAIN`
sırası + `nextProviderInChain` + `checkAllProviderHealth` artık 5 kayıt),
`provider-bridge.test.ts` (yeni sıra + auth hatası sonrası tekrar
denenmediğinin doğrulanması), `provider-adapters-http.test.ts` (401 → 0 ek
deneme vs. 500 → retry farkı), `response-shaping.test.ts` +
`orchestrator-identity.test.ts` (env reset listeleri genişletildi, yeni model
adı), yeni **`provider-auto-order.test.ts`** (`getProviderConfig()` auto
sırası, boş anahtar, case-insensitive `nvidiaNim`, explicit seçim geri
uyumluluğu). 507/507 yeşil, tsc/lint/`prisma validate`/build temiz.

## Session — Bağlamsal AI cevapları (genel "işledim" fallback'ini azaltma)

Provider altyapısına (chain/adapter/fallback routing) dokunulmadı. Bu sprint
YALNIZCA cevap üretimi/formatlama katmanına odaklandı: `orchestrator.ts` ve
`providers/heuristic.ts`.

- **Yeni `src/lib/ai/response-shaping.ts`** — DB/LLM/network çağrısı yapmayan,
  saf formatlama modülü:
  - `summarizeToolResults(toolResults)` — tool bazlı (schedule/attendance/
    balance/makeup-slot/message-draft/payment/generic) İNSAN OKUNUR özet;
    hem `orchestrator.ts`'in (gerçek provider'ın `narrate()`'i boş/hatalı
    dönerse) fallback'i, hem `heuristicProvider.narrate()`'in birincil yolu.
  - `isIdentityQuestion`/`describeIdentity()` — "hangi modelsin" sorusuna
    **deterministik** cevap (LLM'e SORULMUYOR — LLM kendi kimliğini yanlış
    tahmin edebilir). `getProviderConfig()`'ten gerçek provider adı + model;
    heuristic ise NEDENİNİ (hangi env değişkenleri eksik) açıkça söyler.
- **`orchestrator.ts`** (`runChatTurn` + `streamChatTurn`): kimlik sorusu
  ise plan/tool/narrate'e hiç gitmeden (billable AI execution kaydı da
  YOK — hiçbir LLM çağrısı yapılmadığı için) `describeIdentity()` döner.
  Eski `"İşlem tamamlandı."` / `"Size nasıl yardımcı olabilirim?"`
  fallback'leri `summarizeToolResults(toolResults)` (araç sonucu varsa) veya
  somut örnekli bir yönlendirme (`"s1 öğrencisinin bakiyesi"`, ...) ile
  değiştirildi.
- **`providers/heuristic.ts`** — iki gerçek davranış değişikliği:
  1. `pickTool` → `detectIntent`: kategori eşleşip ID BULUNAMAZSA (örn.
     "öğrenci bakiyesi", "telafi öner", ID'siz) artık **uydurma bir
     varsayılan ID'ye (s1/p5/m1/l8/t2) düşüp yanlış kayda karşı tool
     çalıştırmıyor** — hangi bilginin eksik olduğunu söylüyor, gerekirse
     ilgili ekrandaki AI butonuna yönlendiriyor (örn. "yoklama özeti" →
     Yoklama ekranındaki "AI ile özetle"; "telafi öner" (ID'siz) → Telafi
     Merkezi'ndeki "AI ile öncelik özeti"). Bu, chat'in DB'siz/tool'suz
     olduğu için genel bir günlük özet ÜRETEMEYECEĞİNİ dürüstçe söylüyor.
  2. `narrate()`: `toolResults:[]` olduğunda (yani `/api/ai/insights` ve
     `/api/ai/collections`'ın HER ZAMAN geçtiği durum — `provider-bridge.ts`
     hiçbir tool çalıştırmaz, yalnızca narrate eder) artık düz
     `"İsteğinizi işledim."` DEĞİL, `userMessage`'daki (`"<capability
     description>\n\nBağlam: {json}"` biçimi — `provider-bridge.ts`'in
     kendi kurduğu, değiştirilmeyen sözleşme) context JSON'unu 7
     capability'nin HER BİRİ için ayrı ayrı biçimlendirip somut bir cümleye
     döküyor (bkz. `formatCapabilityNarration`). Gerçek bir provider
     (Gemini/Groq/…) yapılandırıldığında bu kod yolu hiç çalışmaz — LLM
     zaten aynı prompt'tan kendi cevabını üretir; bu yalnızca heuristic
     modun (anahtarsız/varsayılan ortamın) dürüst, somut bir cevap
     vermesini sağlıyor.
- **Dokunulmayan alanlar**: `provider-bridge.ts`, `provider-factory.ts`,
  `config.ts`, `plan-invocation.ts`, `capabilities.ts`, tool registry,
  Collections onay akışı, audit/schema/migration — hiçbiri değişmedi.
  `/api/v1/agent/execute` zaten ham tool JSON'u döndürüyor (narrate katmanı
  yok), bu yüzden dokunulmadı.

Testler (yeni): `response-shaping.test.ts` (identity + tool-summary),
`heuristic-provider.test.ts` (ID'siz sorguların artık uydurma tool
çalıştırmadığı + 7 capability'nin narrate biçimlendirmesi),
`orchestrator-identity.test.ts` (uçtan uca `runChatTurn` ile kimlik sorusu,
hem heuristic hem gerçek-provider-yapılandırılmış senaryo). 482/482 yeşil,
tsc/lint/`prisma validate`/build temiz.

### Bilinçli sınırlamalar

- "yoklama özeti" gibi TOPLU/günlük sorular sohbet üzerinden hâlâ
  ÇÖZÜLEMİYOR — tool registry'de böyle bir agregasyon aracı yok (bu
  sprintte tool registry'ye dokunulmadı) ve provider'lar DB'ye doğrudan
  erişemiyor (yalnızca `messages`/`toolResults` görüyorlar). Chat bunun
  yerine dürüstçe ilgili ekrandaki (zaten çalışan) AI butonuna yönlendiriyor.
- Gerçek bir LLM (Gemini/Groq/…) yapılandırıldığında narrate metninin
  kalitesi o sağlayıcının kendi cevabına bağlı — bu sprint yalnızca
  HEURISTIC modun ve gerçek-LLM'in BOŞ/HATALI döndüğü fallback yolunun
  kalitesini garanti ediyor.

## Session — AI'yı ürünün kalan alanlarına yayma

Provider runtime'a (önceki sprint) tekrar dokunulmadı. Bu sprint mevcut
capability/audit/collections altyapısını YENİDEN KULLANARAK dört alana yayıldı:
Collections Intake, AI log birleştirme, decision-support (2 gerçek + 2 planlı),
ve rol bazlı UI görünürlüğünde bir gerçek boşluğun kapatılması.

### A. Collections Intake — sahiplik ve akış

- **Sahip ekran**: `/panel/ai/tahsilat-agent` (Tahsilat) — yeni bir sayfa
  AÇILMADI; `collectionsIntake` zaten aynı domain'in (`collectionsMessageDraft`/
  `collectionsROIReport`) parçası, aynı ekranda yaşaması doğal.
- **Dürüstlük notu**: `executeWithProvider` yalnızca NARRATE eder — hiçbir
  capability (`collectionsIntake` dahil) gerçek bir `FollowUpCase` satırı
  YAZMAZ. Bu yüzden yeni `<CollectionsIntakeScan>` bileşeni açıkça "henüz vaka
  açmaz" diyor ve kullanıcıyı gerçek aksiyon için (zaten var olan, dokunulmamış)
  kuyruktaki "Takip başlat" butonuna yönlendiriyor — sahte bir "vaka açıldı"
  iddiası YOK.
- `useCollectionsAI` hook'una (yeniden kurulmadı, yalnızca genişletildi)
  `scanIntake`/`intakeText`/`isIntakeLoading`/`intakeError` eklendi — mevcut
  `draft`/`status`/`generateDraft`/`approveDraft`/`rejectDraft` state
  machine'ine HİÇ dokunmadan, aynı `/api/ai/collections` endpoint'ini farklı
  `capabilityId` ile çağıran bağımsız bir state seti.
- Yalnızca SUPER_ADMIN/SCHOOL_ADMIN + tek-kurum modunda, takibi başlamamış
  (`caseStatus:"draft"`) kayıt varsa görünür.

### B. AI Log / History birleştirme

- `/panel/ai/logs`: `AiAuditLog` (capability çağrıları) artık BİRİNCİL,
  görünür tablo — yeni `<AiCapabilityLogTable>` (client) ile durum
  (başarılı/hatalı) ve capability'ye göre FİLTRELENEBİLİR.
  `metrics.ts`'in sohbet/tool yürütme logu silinmedi, `<details>` ile
  ikincil/daraltılmış bir bölüme taşındı — iki farklı veri kaynağı (biri
  capability bazlı + onay durumu, diğeri conversation/tool bazlı) gerçek bir
  ortak şemaya sahip olmadığından TEK TABLOYA zorlanmadı; bunun yerine TEK
  EKRANDA, birincil/ikincil hiyerarşiyle sadeleştirildi.

### C. Decision Support AI — 2 gerçek, 2 planlı

Skorun/risk seviyesinin KENDİSİ LLM'siz, deterministik olarak
(`src/lib/insights/*.ts`) hesaplanır — AI yalnızca üstüne okunabilir bir
yorum ekler (`teacherPerformanceScore`/`attendanceRiskAssessment`
capability'leri, ikisi de `capabilities.ts`'e eklendi, `/api/ai/insights`'a
kaydedildi, mevcut audit/policy/provider-chain'i aynen kullanır).

| Use-case | Durum | Veri | Kullanıcı ne görür | Onay? | Rol | Ekran |
|---|---|---|---|---|---|---|
| Öğretmen başarı skoru | **Implemente** | `Attendance` (present/late/absent/cancelled_by_school), gerçek geçmiş | 0–100 skor + "AI ile yorumla" | Hayır | SUPER_ADMIN/SCHOOL_ADMIN (HR-hassas, öğretmenin kendisine kapalı) | `/panel/ogretmenler` |
| Devamsızlık riski | **Implemente** | `Attendance` (art arda/oran), gerçek geçmiş | low/medium/high rozet + "AI ile yorumla" | Hayır | SCHOOL_STAFF (admin+öğretmen) | `/panel/ogrenciler` |
| Zam önerisi | **Yalnız plan** | Hakediş toplamı + öğrenci sayısı trendi + kıdem (mevcut `TeacherFeeRule`/`TeacherPayout`) — "piyasa" verisi yok | Somut bir "%X zam" SAYISI değil, girdi metriklerin özeti + öneri metni | **Evet** (ücret değişikliği hassas bir yönetim kararı) | SUPER_ADMIN/SCHOOL_ADMIN | `/panel/ucret-kurallari` (planlanan) |
| Veli geri bildirimi analizi | **Yalnız plan** | Şemada HİÇBİR feedback modeli yok — implemente etmek uydurma veri gerektirirdi | (gelecek) toplu duygu/temayı özetleyen kart | Hayır (salt okunur özet) | SUPER_ADMIN/SCHOOL_ADMIN | (gelecek — önce bir feedback toplama mekanizması gerekir) |
| Uyarı/öneri kartları | **Implemente edilenlerin sunum biçimi** | yukarıdaki 2 use-case'in kartları | — | — | — | Öğretmenler + Öğrenciler |

"Zam önerisi" ve "Veli geri bildirimi analizi" bu sprintte KOD YAZILMADI —
ikisi de ya gerçek veri kaynağı yok (feedback) ya da somut bir sayı üretmek
"uydurma" olurdu (zam); ikisi de bir sonraki sprint için hazır, veri
kaynağı netleştirilmiş planlar.

### D. Outbound Message Plan — genişletme planı (kod yazılmadı)

`collectionsMessageDraft` deseni (taslak → AYRI AI-onayı → mevcut, dokunulmamış
insan-onaylı gönderim) bu sprintte Tahsilat'ta zaten ÇALIŞTIĞI doğrulandı
(Collections Intake ile aynı ekranda). Genel WhatsApp bildirimleri
(`/panel/bildirimler`) için AYNI deseni uygulamak yeni bir capability
(`notificationMessageDraft`, `requiresApproval:true`) + kendi onay rotası
gerektirir — `/api/ai/collections/approve` teknik olarak capability-agnostik
olsa da (yalnızca `invocationId`+`tenantId` ile çalışır), path adı
"collections"e özel görünüyor; onu farklı bir capability için yeniden
kullanmak yanıltıcı olurdu. Bu yüzden bilinçli olarak SONRAKİ SPRİNT'e
bırakıldı — mimari netleşti (yeni capability + `/api/ai/notifications` +
`/api/ai/notifications/approve`, aynı iki-aşamalı onay deseni), kod yazmak
"collections onay altyapısını yeniden kurma" sınırını zorlardı.

### E. UX / Rol görünürlüğü — gerçek bir boşluk kapatıldı

`TahsilatMessageApproval`'daki "AI ile taslak oluştur" butonu, `TEACHER`
rolünün `/panel/ai/tahsilat-agent`'a erişimi olduğu ve `collectionsMessageDraft`
capability'sinin `allowedRoles`'ında TEACHER OLMADIĞI hâlde, ÖNCEKİ sprintte
role bakmadan gösteriliyordu (sunucu 403 döner ama buton görünürdü). Yeni
`canUseAiDraft` prop'u (`TahsilatQueue` → `TahsilatMessageApproval`) bunu
düzeltti — artık yalnız SUPER_ADMIN/SCHOOL_ADMIN'e görünüyor, capability'nin
kendi `allowedRoles`'ıyla birebir.

Testler: `teacher-performance.test.ts`, `attendance-risk.test.ts` (yeni,
deterministik skor/risk mantığı), `ai-insights-route.test.ts` genişletildi
(2 yeni capability + rol reddi). 451/451 yeşil, tsc/lint/`prisma validate`/
build temiz.

## Session — Real Multi-Provider Runtime

`PROVIDER_CHAIN` (provider-chain.ts) artık metadata değil, gerçek runtime
routing. `chosenProvider` gerçekten o provider'a gidiyor; yapılandırılmamış/
timeout/HTTP hatası veren provider zincirdeki bir SONRAKİ configured provider'a
düşüyor, son adım her zaman heuristic. UI/Collections/audit-hook/schema/tool
registry/workflow engine/memory layer'a dokunulmadı.

- **`config.ts`**: yeni `resolveChainProviderConfig(id)` — mevcut
  `getProviderConfig()`'i (chat orchestrator'ın TEK global provider'ı,
  değiştirilmedi) değil, `PROVIDER_CHAIN`'deki HER provider'ı kendi env
  değişkenleriyle çözer. Env yoksa `configured:false` döner, asla fırlatmaz,
  asla sahte/varsayılan anahtar üretmez.
- **`provider-factory.ts`**: yeni `resolveLiveProvider(id: ProviderId)` —
  gemini kendi native adapter'ına, groq/cerebras/nvidiaNim mevcut
  `openai-compatible.ts`'e (kendi baseUrl/model/key ile), cloudflareAi yeni
  kendi adapter'ına çözülür; unconfigured olan `null` döner (mevcut
  `getLlmProvider()` — chat orchestrator için TEK provider seçen fonksiyon —
  değiştirilmedi, ayrı kalıyor).
- **`providers/cloudflare-workers-ai.ts`** (yeni): Cloudflare Workers AI'ın
  resmi REST sözleşmesi (`POST /accounts/:id/ai/run/:model`, `Bearer` token,
  `{messages}` gövde, `result.response` çıktı) — OpenAI-compatible DEĞİL,
  bu yüzden ayrı, küçük bir adapter. Tool-calling desteklenmiyor (model
  başına sözleşme tutarsız/doğrulanamaz) — yalnızca `narrate()`/metin.
- **`provider-bridge.ts`**: `executeWithProvider` artık `nextProviderInChain`
  ile TAM zincir yürüyor (`chosenProvider` → başarısız → sıradaki configured
  → ... → heuristic), tek atlamalı eski `fallbackProvider` davranışının
  yerine. `ProviderExecutionResult`'a `triedProviders: ProviderId[]` eklendi
  (denenen tüm provider'lar, sırayla) — mevcut `provider`/`result`/
  `usedFallback` alanları ve audit çağrı şekli korundu.
- **`metrics.ts`** + **`/api/v1/ai/health`**: yeni `checkAllProviderHealth()`
  — zincirdeki 6 provider için configured/model/status (API anahtarı/token
  asla dönmez); mevcut, UI-DIŞI health route'una (`GET /api/v1/ai/health`)
  `chain` alanı olarak eklendi. `checkProviderHealth()` (tek aktif orchestrator
  provider'ı) ve dashboard UI'ı DOKUNULMADI.
- **`types.ts`**: `LlmProviderName`'a `groq`/`cerebras`/`nvidiaNim`/
  `cloudflareAi` eklendi (ek, geriye uyumlu). Not: "groq" (Groq Cloud,
  api.groq.com) ile mevcut "grok" (xAI, api.x.ai) FARKLI sağlayıcılar —
  isim benzerliği kasıtlı değil, ikisi de ayrı ayrı korunuyor.

### Runtime'da desteklenen provider tablosu

| Provider | Adapter | Gerekli env | Zincirdeki sıradaki |
|---|---|---|---|
| `gemini` | `providers/gemini.ts` (native) | `GEMINI_API_KEY` (veya `GOOGLE_API_KEY`), `GEMINI_MODEL` (ops.) | `groq` |
| `groq` | `providers/openai-compatible.ts` | `GROQ_API_KEY`, `GROQ_MODEL`/`GROQ_BASE_URL` (ops.) | `cerebras` |
| `cerebras` | `providers/openai-compatible.ts` | `CEREBRAS_API_KEY`, `CEREBRAS_MODEL`/`CEREBRAS_BASE_URL` (ops.) | `nvidiaNim` |
| `nvidiaNim` | `providers/openai-compatible.ts` | `NVIDIA_NIM_API_KEY`, `NVIDIA_NIM_MODEL`/`NVIDIA_NIM_BASE_URL` (ops.) | `cloudflareAi` |
| `cloudflareAi` | `providers/cloudflare-workers-ai.ts` (yeni, özel REST) | `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_AI_MODEL` (ops.) | `heuristic` |
| `heuristic` | `providers/heuristic.ts` | — (her zaman configured) | — (zincir sonu) |

### Bilinçli olarak yapılmayanlar

- Cloudflare Workers AI'da tool/function-calling — model başına sözleşme
  tutarsız, güvenle doğrulanamadı; yalnızca metin/narrate desteği var.
- `getLlmProvider()`/`getProviderConfig()` (chat orchestrator'ın tek-provider
  seçimi) zincire bağlanmadı — kasıtlı olarak ayrı kaldı (farklı sorumluluk:
  sohbet vs. capability-bazlı çoklu-provider routing).
- Gerçek HTTP sağlık probu (ping) yok — `checkAllProviderHealth()` yalnızca
  "env yapılandırılmış mı" kontrolü yapıyor, tıpkı mevcut
  `checkProviderHealth()` gibi.

### `.env.local`'a eklenmesi gereken anahtar isimleri (değer yazılmadı)

```
GEMINI_API_KEY=
GEMINI_MODEL=
GROQ_API_KEY=
GROQ_MODEL=
GROQ_BASE_URL=
CEREBRAS_API_KEY=
CEREBRAS_MODEL=
CEREBRAS_BASE_URL=
NVIDIA_NIM_API_KEY=
NVIDIA_NIM_MODEL=
NVIDIA_NIM_BASE_URL=
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_AI_MODEL=
OPENAI_API_KEY=
OPENAI_MODEL=
AI_PROVIDER=
AI_TIMEOUT_MS=
AI_RETRY_COUNT=
```

Testler: `provider-chain-runtime.test.ts`, `provider-adapters-http.test.ts`
(yeni; tüm HTTP çağrıları mock'lu, gerçek API key/network gerektirmez),
`provider-bridge.test.ts` zincir-boyunca-fallback için genişletildi.
434/434 test yeşil, tsc/lint/`prisma validate`/build temiz.

## Session — AI'ı görünür ürün akışına dönüştürme (Sprint-09)

AI artık "arka planda çalışan servis" değil — kullanıcı ekranda buton, kart, taslak
ve onay akışı olarak görüyor. Hiçbiri `capabilities.ts`/tool registry/workflow
engine/memory katmanını değiştirmedi; hepsi mevcut `provider-bridge.ts` +
`plan-invocation.ts` + `audit-hook.ts` üzerine ince bir UI katmanı.

- **`/api/ai/insights`** (yeni route, POST): `attendanceDailySummary` /
  `makeupSlotSuggestion` / `collectionsROIReport` — onay gerektirmeyen 3
  capability. `/api/ai/collections`'ın aksine her zaman `status:"completed"`
  döner; mesaj taslağı/gönderim bu route'un kapsamı dışında.
- **`useAiInsight(capabilityId)`** (`src/hooks/`) + **`<AiInsightTrigger>`**
  (`src/components/ai/`): tek, küçük, tekrar kullanılabilir buton+kart bileşeni —
  üç ayrı ekranda (Yoklama/Telafi/Tahsilat) kopyalanmadı.
- **Yoklama** (`/panel/yoklama`): "AI ile özetle" — bugünün yoklama sayaçlarını
  (geldi/geç/gelmedi/okul iptal/henüz alınmadı) bağlam olarak geçiyor.
- **Telafi Merkezi** (`/panel/telafi`): "AI ile öncelik özeti" — açık taleplerin
  enstrüman dağılımı + yakında süresi dolacaklar. Mevcut "Uygun saatleri bul"
  (deterministik `makeup-engine.ts`) akışına DOKUNULMADI — bu, ona ek bir
  öncelik/özet katmanı, kopyası değil.
- **Tahsilat — mesaj taslağı** (`TahsilatMessageApproval` bileşeni): "AI ile
  taslak oluştur" butonu yalnızca `status==="draft"` iken görünür,
  `useCollectionsAI`'ı (Sprint-08'den, ilk kez bir ekrana bağlandı) çağırır.
  Dönen taslak "AI onayı gerekiyor" etiketiyle ayrı bir kartta gösterilir;
  **Kullan** → `approveDraft()` + metni mevcut (değiştirilmemiş) düzenlenebilir
  textarea'ya yazar; **Vazgeç** → `rejectDraft()`, mevcut metin korunur. Gerçek
  onay/gönderim hâlâ aynı, dokunulmamış akış (Onayla → WhatsApp'ta aç) —
  AI onayı ve insan-onaylı-gönderim iki AYRI, ardışık adım.
- **Tahsilat — ROI analizi**: "AI analiz üret" (`collectionsROIReport`) yalnızca
  SUPER_ADMIN/SCHOOL_ADMIN'e görünür (capability'nin `allowedRoles`'ı ile
  birebir); TEACHER de bu sayfaya erişebildiği için UI'da da gizlendi (yalnız
  sunucu tarafı `planAiInvocation` reddine güvenmek yerine).
- **`/panel/ai/logs`**: yeni "Capability çağrıları" tablosu — `AiAuditLog`'u
  (Sprint-08, o zamana kadar hiç okunmuyordu) tenant-scoped okuyan yeni
  `listAiAuditLogs()` (audit-hook.ts) ile besleniyor; capability, rol, provider,
  onay durumu, başarı/hata. Mevcut "Sohbet/araç yürütmeleri" tablosu (lightweight
  `metrics.ts`) korunuyor — iki log hâlâ paralel, birleştirilmedi (bkz. Next steps).
- Testler: `ai-insights-route.test.ts` (yeni), `audit-hook.test.ts`'e
  `listAiAuditLogs` kapsamı eklendi. 410/410 yeşil, tsc/lint/build temiz.

### Capability → ekran haritası (bugünkü durum)

| Capability | Ekran | Tetikleyici | Onay? | Rol görünürlüğü |
|---|---|---|---|---|
| `attendanceDailySummary` | `/panel/yoklama` | "AI ile özetle" | Hayır | SUPER_ADMIN/SCHOOL_ADMIN/TEACHER (sayfa zaten bu rollere kapalı değil) |
| `makeupSlotSuggestion` | `/panel/telafi` | "AI ile öncelik özeti" | Hayır | aynı (+AI_AGENT, UI'da ilgisiz) |
| `collectionsIntake` | — | (henüz UI yok, bkz. Next steps) | Hayır | — |
| `collectionsMessageDraft` | `/panel/ai/tahsilat-agent` → `TahsilatMessageApproval` | "AI ile taslak oluştur" | **Evet** (ayrı UI onayı + ayrı gönderim onayı) | SUPER_ADMIN/SCHOOL_ADMIN (AI_AGENT UI'da yok) |
| `collectionsROIReport` | `/panel/ai/tahsilat-agent` | "AI analiz üret" | Hayır | yalnız SUPER_ADMIN/SCHOOL_ADMIN — UI'da gizli |

### Sprint-09'dan sonra kalan UI işi

- `collectionsIntake`'in kendi ekranı yok — bugün yalnız `/api/ai/collections`
  üzerinden erişilebilir bir capability; hangi ekranın (Tahsilat kuyruğu mu,
  ayrı bir "yeni vaka" formu mu) sahiplenmesi gerektiği Orion/Atlas kararı.
- AI log ekranındaki iki tablo (`AiAuditLog` + `metrics.ts` execution log)
  hâlâ birleştirilmedi — aynı invocation'ı iki yerden takip etmek gerekiyor.
- Karar-destek işleri (zam/ücret önerisi, öğretmen performans/devamsızlık/veli
  geri bildirimi kartları, otomatik WhatsApp/e-posta taslak onayı) yalnız
  planlama seviyesinde ele alındı, kod yazılmadı — bkz. sprint tamamlanma
  raporu.

## Session — Provider bridge, audit trail & collections API (Sprint-08)

- **`provider-bridge.ts`**: `executeWithProvider(capabilityId, payload, context)` —
  `planAiInvocation` ile planlar, mevcut `provider-factory.ts`'i (değiştirmeden)
  köprüler. `chosenProvider` başarısız olursa `fallbackProvider`'a (her zaman
  heuristic) otomatik düşer. Audit yazımı **fire-and-forget** (`void`, kritik yolda
  await yok). `groq`/`cerebras`/`nvidiaNim`/`cloudflareAi` için henüz gerçek bir
  `LlmProvider` yok — bunlar bugün env'den yapılandırılmış TEK canlı provider'a
  (`getLlmProvider()`) devredilir; dürüst, minimal bir köprü, gerçek çoklu-provider
  yönlendirmesi değil.
- **`gemini-tools.ts`**: `capabilities.ts.linkedTools` → agent tool registry'den
  (`listToolDefinitions`, değiştirilmedi) Gemini function-calling `ToolDescriptor[]`.
  Registry'de olmayan bir `linkedTools` girişi (ör. `upsertFollowUpCase`,
  tahsilat/cases.ts'ten) `console.warn` + atla — asla fırlatmaz.
- **`audit-hook.ts`**: `AiAuditLog` tablosuna (yeni migration, tek tablo) yazan
  `recordAiAuditLog` (upsert, id verilirse aynı satırı günceller) ve
  `recordApprovalDecision` (WHERE `id`+`tenantId` — tenant-scoped, sızma yok).
  İkisi de **asla fırlatmaz**; DB yokken (`STORE_MODE=json`/`memory`) bile
  `{persisted:false}`/`{ok:false}` ile deterministik döner.
- **`/api/ai/collections`** (POST): `capabilityId ∈ {collectionsIntake,
  collectionsMessageDraft}` — `tenantId`/`callerRole` YALNIZ oturumdan
  (`withApiHandler` → `ctx`), asla body'den. `collectionsMessageDraft` →
  `status:"pending_approval"`; `collectionsIntake` → `status:"completed"`.
- **`/api/ai/collections/approve`** (POST): yalnızca `AiAuditLog.approvalStatus`'u
  günceller — **hiçbir gönderim tetiklemez**; gerçek gönderim hâlâ mevcut,
  değiştirilmemiş Tahsilat ekranının (wa.me deep link, insan tetikli) işi.
- **`useCollectionsAI(tenantId)`** hook'u (`src/hooks/`, ilk kez): `generateDraft`/
  `approveDraft`/`rejectDraft` — yalnızca fetch, UI bileşeni yok.
- Migration: `prisma/migrations/20260802152131_add_ai_audit_log` — **tek tablo**
  (`AiAuditLog`), `Tenant` FK'sı YOK (kasıtlı — audit trail tenant silinse de
  kalmalı; izolasyon uygulama katmanında `tenantId` eşleşmesiyle sağlanıyor).
  Not: proje bugün `prisma db push` kullanıyor (migration geçmişi yoktu) —
  bu dosya gerçek, canlı yerel MySQL'e karşı (`SHOW CREATE TABLE`) doğrulanan
  DDL'dir; `prisma migrate deploy`'a resmî geçiş ayrı bir iştir.

## Session — AI capabilities, providers & API flow (iskelet, faz 1)

- Metadata-only **capability registry** (`src/lib/ai/capabilities.ts`): 5 capability
  (attendance summary, makeup slot suggestion, collections intake/message-draft/ROI),
  her biri `allowedRoles` + `requiresApproval` + `linkedTools` (mevcut agent tool'ları /
  `tahsilat/cases.ts` fonksiyonları) + `preferredProvider` taşır. LLM/DB çağrısı yok.
- **Provider chain skeleton** (`src/lib/ai/provider-chain.ts`): Gemini → Groq →
  Cerebras → NVIDIA NIM → Cloudflare Workers AI → Heuristic sıralı metadata listesi.
  Gerçek HTTP entegrasyonu yok — mevcut `provider-factory.ts`'ten bağımsız bir
  politika katmanı.
- **`planAiInvocation`** (`src/lib/ai/plan-invocation.ts`): API/domain service'in
  agent executor'a gitmeden önce sorduğu tek soru — "bu çağrı bu kullanıcı için
  izinli mi, hangi provider ile?" Eksik tenant/rolde **fail-closed**.

## Akış (metin diyagramı)

```
Kullanıcı (panel / portal / AI chat)
  → REST API v1 / Next.js route (JWT + RBAC + tenant)
  → Domain service (attendance, payments, makeup, workflows)
  → AI capability layer            [capabilities.ts]
  → Policy (role, tenant, approval, allowed tools)   [plan-invocation.ts]
  → Provider chain (Gemini, Groq, Cerebras, NVIDIA NIM, Cloudflare, Heuristic)
  → Tools (mevcut agent tool registry — src/lib/agent/registry.ts)
  → Response shaping (drafts / summaries)
  → Audit & metrics (collections ROI, AI usage)
```

## Capability'ler (bugünkü metadata)

| Capability | Roller | Onay gerekli mi | Tercih edilen provider |
|---|---|---|---|
| `attendanceDailySummary` | SUPER_ADMIN, SCHOOL_ADMIN, TEACHER | Hayır | groq |
| `makeupSlotSuggestion` | + AI_AGENT | Hayır | heuristic *(bugün zaten deterministik — makeup-engine.ts)* |
| `collectionsIntake` | SUPER_ADMIN, SCHOOL_ADMIN, AI_AGENT | Hayır *(taslak açmak; SEND adımı ayrı)* | heuristic |
| `collectionsMessageDraft` | SUPER_ADMIN, SCHOOL_ADMIN, AI_AGENT | **Evet** | gemini |
| `collectionsROIReport` | SUPER_ADMIN, SCHOOL_ADMIN | Hayır | groq |

## Provider chain

> Bu bölüm sprint iskelet fazından (metadata-only, HTTP entegrasyonu yoktu)
> kalma; güncel/canlı sıra ve gerekli env değişkenleri için dosyanın en
> başındaki "Güncel Durum — AI Runtime" bölümüne bakın.

- Primary: **Gemini** (tool-calling, Türkçe/ders bağlamı)
- Secondary: **Groq** (short-fast, kısa görevler)
- Tertiary: **NVIDIA NIM** (enterprise/özel durumlar)
- Quaternary: **Cerebras** (long-context)
- Fallback: **Heuristic** (external LLM yokken deterministik)

## Safety (bozulmayan kurallar)

- Her veri yolu JWT `tenantId` ile sınırlı — `planAiInvocation` boş/eksik
  tenant'ta **fail-closed** reddeder, `DEFAULT_TENANT_ID`'ye düşmez
  (bkz. DATABASE_ARCHITECTURE.md Gap DB-3 yönü — store katmanına dokunulmadı).
- RBAC rol kontrolü her capability'de `allowedRoles` ile uygulanıyor
  (SUPER_ADMIN, SCHOOL_ADMIN, TEACHER, PARENT, AI_AGENT).
- Outbound mesaj taslakları (`collectionsMessageDraft`) `requiresApproval: true` —
  US-05/AC-11/AC-12'yi bozmaz, insan onayı zorunluluğu korunur.
- LLM çıktıları hiçbir yeni kodda doğrudan DB'ye yazılmıyor — bu katman salt metadata.
- db modunda tenant context yoksa fail-closed (yukarıdaki madde).

## API akışına bağlanma (Sprint-08 itibarıyla `/api/ai/collections*` üzerinden canlı)

- `route.ts`: `planAiInvocation(capabilityId, {callerRole, tenantId, operation})` →
  `allowed:false` ise 403 + kullanıcıya gösterilebilir `reason`.
- `allowed:true` ise `executeWithProvider(...)` çağrılır; sonuç + `invocationId` +
  `status` (`pending_approval`/`completed`) döner.
- `approve/route.ts`: yalnızca `AiAuditLog.approvalStatus`'u günceller, gönderim
  tetiklemez.
- Tahsilat ekranı (`/panel/ai/tahsilat-agent`) **Sprint-09'dan itibaren**
  `useCollectionsAI`'a bağlı (bkz. yukarıdaki Sprint-09 bölümü). AI Assistant
  chat (`/panel/chat`) hâlâ kendi (orchestrator.ts tabanlı, bu katmandan
  bağımsız) yolunu kullanıyor.

## Next steps

- ~~Gerçek provider entegrasyonu (Groq/Cerebras/NVIDIA NIM/Cloudflare SDK'ları) —
  bugün `provider-bridge.ts` bunları tek, env'den yapılandırılmış canlı provider'a
  devrediyor.~~ **"Real Multi-Provider Runtime" + sonraki "Provider sırası
  finalize" sprintlerinde tamamlandı** — bkz. yukarıdaki "Güncel Durum" bölümü.
- `prisma migrate deploy`'a resmî geçiş (bugün `db push`; bu sprintin migration
  dosyası ileriye dönük, henüz bir CI/CD adımı tarafından uygulanmıyor).
- `auditLog`'un (mevcut, hafif JSON hook) `AiAuditLog` (yeni, sorgulanabilir tablo)
  ile ilişkilendirilmesi — bugün ikisi paralel, birbirine referans vermiyor.
- Test/CI genişletmesi (PRODUCTION_AUDIT.md'deki "Test" boşluğu).
- ~~`useCollectionsAI`'ın gerçek bir ekrana (Tahsilat) bağlanması + onay UI'ı.~~
  **Sprint-09'da tamamlandı** — bkz. yukarıdaki bölüm.
- Collections/telafi agent'ta daha güçlü policy akışları (rate limit, quota).
- `collectionsIntake`'in kendi ekranı (bkz. Sprint-09 sonu, "kalan UI işi").
- Karar-destek AI işleri (zam önerisi, öğretmen/veli sinyalli içgörü kartları,
  otomatik taslak onay akışları) — Sprint-09'da yalnız planlandı.
