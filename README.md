# NotaPlan

Müzik okulları için operasyon SaaS: **program, yoklama, telafi planlama, ödemeler, WhatsApp şablonları, veli & öğretmen portalı**.

## İlk müşteri

**[Nilüfer Acar Müzik Akademisi](https://www.niluferacar.com.tr)** — İzmir

| Şube | Not |
|------|-----|
| **Erzene** (Merkez) | Erzene Mah. Türkeli Cad. No:18/A Bornova |
| **Evka 3** | Bornova / İzmir |

**Telefon:** 0553 848 16 58 · **E-posta:** merhaba@niluferacar.com.tr

**Aktif enstrümanlar (şimdilik):** Piyano, Yan Flüt, Gitar, Bateri, Keman, Şan  
*(Bağlama, ud, klarnet vb. sonra eklenebilir.)*

## Sayfalar

| URL | Açıklama |
|-----|----------|
| `/` | Landing + fiyatlandırma |
| `/panel` | Yönetim paneli (özet) |
| `/panel/telafi` | Telafi merkezi ★ |
| `/panel/yoklama` | Yoklama → telafi hakkı |
| `/panel/bildirimler` | WhatsApp mesaj kuyruğu |
| `/veli` | Veli mobil portal (demo) |
| `/ogretmen` | Öğretmen mobil portal (demo) |

## Demo senaryosu

1. `/panel/yoklama` → **Gelmedi (+telafi)**
2. `/panel/telafi` → **Uygun slot öner** → **Onayla**
3. `/panel/bildirimler` → **WhatsApp’ta aç**

## Çalıştırma

```bash
# Node 18+
export PATH="$HOME/.local/node-v22.14.0-darwin-arm64/bin:$PATH"  # gerekirse

cd notaplan
npm install
npm run dev
```

→ [http://localhost:3000](http://localhost:3000)

## Canlıya alma

### Hızlı demo (varsayılan)
`STORE_MODE=memory` veya `json` — Vercel üzerinde MySQL olmadan da çalışır (demo veri).

Vercel env:
```env
STORE_MODE=memory
```

### Kalıcı production (MySQL)
```env
STORE_MODE=db
DATABASE_PROVIDER=mysql
DATABASE_URL=mysql://user:password@host:3306/database
```

1. GitHub repo: https://github.com/hidircan/notaplan
2. [vercel.com/new](https://vercel.com/new) → Import `hidircan/notaplan`
3. Env variables ekle → Deploy
4. `prebuild` otomatik `prisma generate` çalıştırır

> Not: `STORE_MODE=db` için MySQL/MariaDB (PlanetScale, RDS, Aiven vb.) gerekir.

## Multi-Tenant Demo (kurum odağı doğrulaması)

Kurum seçici ve yazma-kapsamı koruması (`src/lib/institution/*`) json/memory
modunda tek kurumla çalışır ama gerçek çoklu-kurum davranışı yalnızca
**`STORE_MODE=db`** ile, gerçekten 2+ ayrı `Tenant` satırı olan bir
MySQL/MariaDB üzerinde gözlemlenebilir. Aşağıdaki adımlar iki izole,
gerçek kurum (`NotaPlan Demo Akademi`, `NotaPlan Test Kampüs`) seed eder.

> ⚠️ **Yalnızca yerel geliştirme/demo içindir.** Aşağıdaki şifreler
> ortam değişkeni verilmezse sabit demo değerlerine düşer — bunları asla
> production'da varsayılan bırakmayın; her ortamda `AUTH_*` değişkenlerini
> kendi güçlü değerlerinizle ayarlayın.

### 1) Veritabanı hazırla

```bash
# MySQL/MariaDB'nin yerel/erişilebilir bir instance'ı olmalı
mysql -u root -e "CREATE DATABASE notaplan_demo CHARACTER SET utf8mb4;"

export DATABASE_URL="mysql://root@localhost:3306/notaplan_demo"
npx prisma db push --url="$DATABASE_URL" --accept-data-loss
```

### 2) İki kurumu seed et

```bash
STORE_MODE=db DATABASE_URL="$DATABASE_URL" npx tsx scripts/seed-multi-tenant.ts
```

Bu betik `NotaPlan Demo Akademi` (mevcut varsayılan tenant) ve
`NotaPlan Test Kampüs` (yeni, ayrı bir tenant) için şube/öğretmen/öğrenci/
oda/ders/yoklama/ödeme oluşturur — **hiçbir kimlik paylaşılmaz** — ve
ardından `listTenants`/`readData`/`mergeAppData`'yı bu canlı veriye karşı
çalıştırıp sonucu konsola yazdırır. Yeniden çalıştırmak güvenlidir (her
kurumun kendi verisini siler ve yeniden oluşturur, diğer kurumu etkilemez).

### 3) Uygulamayı db modunda başlat

```bash
STORE_MODE=db DATABASE_URL="$DATABASE_URL" npm run dev
```

### Demo hesapları (yalnızca dev — env ile geçersiz kılın)

| Rol | E-posta | Şifre (env değişkeni / varsayılan) | Kapsam |
|-----|---------|-------------------------------------|--------|
| Kurum sahibi (SUPER_ADMIN) | `super@notaplan.app` | `AUTH_SUPER_PASSWORD` / `demo-super` | Her iki kurum, varsayılan "Tüm kurumlar" |
| Kurum müdürü (SCHOOL_ADMIN) | `admin@niluferacar.com.tr` | `AUTH_ADMIN_PASSWORD` / `demo-admin` | Yalnızca NotaPlan Demo Akademi |
| Kurum müdürü (SCHOOL_ADMIN) | `admin@testkampus.notaplan.app` | `AUTH_TEST_ADMIN_PASSWORD` / `demo-test-admin` | Yalnızca NotaPlan Test Kampüs |

### Manuel doğrulama akışı

1. **Kurum sahibi** olarak giriş yap → sidebar'da kurum seçicinin
   varsayılan olarak **"Tüm kurumlar"** seçili geldiğini doğrula.
2. Öğrenciler/Öğretmenler/Program gibi ekranlarda her iki kurumun
   **birleşik, salt okunur** verisinin göründüğünü ve üstte "Tüm kurumlar
   görünümü — 2 kurumun birleşik verisi gösteriliyor" notunun çıktığını
   doğrula.
3. 10 ekranın (Özet, Ders Programı, Tahsilat, Ödemeler, Telafi, Öğrenciler,
   Öğretmenler, Hakediş, WhatsApp, Yoklama) her birinde bir mutasyon
   dene (ör. yeni öğrenci ekle, yoklama işaretle, ödeme kaydet) — hepsinin
   **"Tüm kurumlar görünümünde işlem yapılamaz. Lütfen önce tek bir kurum
   seçin."** mesajıyla engellendiğini doğrula.
4. Kurum seçiciden **NotaPlan Demo Akademi**'yi seç → her ekranda birer
   kayıt oluştur/düzenle (öğrenci ekle, yoklama al, ödeme kaydet vb.).
5. Kurum seçiciden **NotaPlan Test Kampüs**'e geç → 4. adımda oluşturulan
   kayıtların **görünmediğini** (izolasyon) doğrula.
6. Çıkış yap, **kurum müdürü** (`admin@niluferacar.com.tr`) olarak giriş
   yap → kurum seçici yerine düz "NotaPlan Demo Akademi" etiketinin
   göründüğünü, Test Kampüs'e dair hiçbir verinin görünmediğini doğrula.
7. Tarayıcı geliştirici araçlarından `notaplan_kurum` cookie'sini elle
   `tenant_test_kampus` yap (sahte/forge deneme) ve sayfayı yenile →
   hâlâ yalnızca kendi kurumunun (Demo Akademi) verisinin göründüğünü ve
   herhangi bir mutasyonun hâlâ yalnızca Demo Akademi'ye yazıldığını
   doğrula (asla Test Kampüs'e sızmaz).

### Demo verisini sıfırlama (db modu)

Panel özet sayfasındaki **Demo verisini sıfırla** butonu yalnızca
**oturumun kendi kurumunu** sıfırlar (yetki kontrollü, tenant-scoped —
`resetDemoTool` her zaman `ctx.tenantId`'ye göre çalışır). Diğer kurumu
asla etkilemez ve production'da varsayılan olarak otomatik çalışmaz —
yalnızca panelden elle tetiklenir.

## Teknik

Demo verisini sıfırlamak: panel özet sayfasındaki **Demo verisini sıfırla**.

## Teknik

- Next.js (App Router) + TypeScript + Tailwind
- Prisma + MySQL production-ready persistence
- Telafi motoru: `src/lib/makeup-engine.ts` (şube + öğretmen + oda skoru)
- WhatsApp şablonları: `src/lib/whatsapp-templates.ts`

## Fiyat (referans)

- Başlangıç: ~2.500 ₺/ay (1 şube)
- Akademi: ~4.500 ₺/ay (2 şube + portaller) — **önerilen**
- Kurumsal: özel

## Repo

https://github.com/hidircan/notaplan
