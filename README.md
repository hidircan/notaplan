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
