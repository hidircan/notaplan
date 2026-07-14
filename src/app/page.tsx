import Link from "next/link";
import {
  CalendarDays,
  Check,
  MessageCircle,
  Music2,
  RefreshCcw,
  Sparkles,
  MapPin,
  ExternalLink,
  ArrowRight,
} from "lucide-react";

export const dynamic = "force-dynamic";

const features = [
  {
    icon: RefreshCcw,
    title: "Telafi merkezi",
    desc: "Devamsızlık veya okul iptali → otomatik telafi hakkı → skorlu slot önerisi → tek tık onay.",
  },
  {
    icon: CalendarDays,
    title: "2 şubeli program",
    desc: "Erzene ve Evka 3 için ayrı stüdyo, öğretmen ve ders akışı. Çakışma yok.",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp şablonları",
    desc: "Veli ve öğretmene hazır mesajlar: telafi, hatırlatma, ödeme. wa.me ile tek tık gönder.",
  },
];

const instruments = ["Piyano", "Yan Flüt", "Gitar", "Bateri", "Keman", "Şan"];

const plans = [
  {
    name: "Başlangıç",
    price: "2.500 ₺",
    period: "/ay",
    blurb: "Tek şube, temel telafi + program",
    features: ["1 şube", "Telafi motoru", "Yoklama", "Öğrenci / öğretmen", "WhatsApp şablonları"],
    cta: "Demo iste",
    highlighted: false,
  },
  {
    name: "Akademi",
    price: "4.500 ₺",
    period: "/ay",
    blurb: "Nilüfer Acar gibi 2 şubeli okullar için",
    features: [
      "2 şube (Erzene + Evka 3)",
      "Telafi + öncelikli yerleştirme",
      "Veli & öğretmen portali",
      "Ödeme takibi",
      "Kurulum + 1 saat eğitim",
    ],
    cta: "Önerilen paket",
    highlighted: true,
  },
  {
    name: "Kurumsal",
    price: "Özel",
    period: "",
    blurb: "Çok şube, özel entegrasyon",
    features: ["Sınırsız şube", "SMS / WhatsApp API", "Özel raporlar", "Öncelikli destek", "Marka uyumu"],
    cta: "İletişime geç",
    highlighted: false,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0612] text-white">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500">
            <Music2 className="h-4 w-4" />
          </div>
          <span className="font-semibold tracking-wide">NotaPlan</span>
        </div>
        <nav className="hidden items-center gap-6 text-sm text-slate-300 sm:flex">
          <a href="#ozellikler" className="hover:text-white">
            Özellikler
          </a>
          <a href="#fiyat" className="hover:text-white">
            Fiyatlandırma
          </a>
          <a href="#musteri" className="hover:text-white">
            İlk okul
          </a>
          <Link
            href="/panel"
            className="rounded-xl bg-white px-4 py-2 font-medium text-slate-900 hover:bg-violet-100"
          >
            Panele gir
          </Link>
        </nav>
        <Link
          href="/panel"
          className="rounded-xl bg-white px-3 py-2 text-sm font-medium text-slate-900 sm:hidden"
        >
          Panel
        </Link>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-6 pb-20 pt-10 text-center sm:pt-16">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_rgba(139,92,246,0.35),_transparent_55%)]" />
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-200">
          <Sparkles className="h-3.5 w-3.5" />
          Müzik okulları için operasyon SaaS
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
          Telafi derslerini{" "}
          <span className="bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
            WhatsApp kaosundan
          </span>{" "}
          kurtar
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-slate-300 sm:text-lg">
          Yoklama, program, telafi planlama, ödemeler ve veli bildirimi tek panelde. İlk uygulama:{" "}
          <strong className="text-white">Nilüfer Acar Müzik Akademisi</strong> — Erzene & Evka 3.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/panel"
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold shadow-lg shadow-violet-600/30 hover:bg-violet-500"
          >
            Canlı demo paneli
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/veli"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium hover:bg-white/10"
          >
            Veli portalı
          </Link>
          <Link
            href="/ogretmen"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium hover:bg-white/10"
          >
            Öğretmen portalı
          </Link>
        </div>
      </section>

      {/* First customer */}
      <section id="musteri" className="border-y border-white/10 bg-white/[0.03] py-14">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-sm font-medium text-violet-300">İlk sunum müşterisi</p>
            <h2 className="mt-2 text-3xl font-semibold">Nilüfer Acar Müzik Akademisi</h2>
            <p className="mt-3 text-slate-300">
              2016&apos;dan beri Bornova / İzmir. MEB&apos;e bağlı eğitim kurumu. Her yaşa uygun
              enstrüman eğitimi.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-slate-300">
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />
                <span>
                  <strong className="text-white">Erzene şubesi</strong> — Erzene Mah. Türkeli Cad.
                  No:18/A Bornova
                </span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-400" />
                <span>
                  <strong className="text-white">Evka 3 şubesi</strong> — Bornova / İzmir
                </span>
              </li>
              <li className="text-slate-400">
                Tel: 0553 848 16 58 · merhaba@niluferacar.com.tr
              </li>
            </ul>
            <a
              href="https://www.niluferacar.com.tr"
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-violet-300 hover:text-violet-200"
            >
              niluferacar.com.tr
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-violet-600/20 to-fuchsia-600/10 p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-200">
              Aktif dersler
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {instruments.map((i) => (
                <span
                  key={i}
                  className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-sm"
                >
                  {i}
                </span>
              ))}
            </div>
            <p className="mt-4 text-xs text-slate-400">
              Yeni enstrümanlar (bağlama, ud, klarnet vb.) panele kolayca eklenebilir.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-2xl bg-black/30 p-4">
                <p className="text-2xl font-semibold">2</p>
                <p className="text-xs text-slate-400">Şube</p>
              </div>
              <div className="rounded-2xl bg-black/30 p-4">
                <p className="text-2xl font-semibold">6</p>
                <p className="text-xs text-slate-400">Enstrüman (şu an)</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="ozellikler" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-center text-3xl font-semibold">Okulun her gün kullandığı araçlar</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-slate-400">
          Excel ve sohbet grupları yerine tek sistem. Müdüre 5 dakikada anlatılır.
        </p>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-6"
            >
              <f.icon className="h-8 w-8 text-violet-300" />
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-5 text-sm text-amber-100">
          <strong>Demo akışı:</strong> Yoklama → Gelmedi → Telafi hakkı → Slot öner → Onayla →
          WhatsApp mesajı hazır.
        </div>
      </section>

      {/* Pricing */}
      <section id="fiyat" className="border-t border-white/10 bg-white/[0.02] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-3xl font-semibold">Fiyatlandırma</h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-slate-400">
            İlk okula pilot + kurulum. Fiyatlar referans; sözleşmede netleşir.
          </p>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {plans.map((p) => (
              <div
                key={p.name}
                className={`rounded-3xl border p-6 ${
                  p.highlighted
                    ? "border-violet-400/50 bg-gradient-to-b from-violet-600/30 to-transparent shadow-xl shadow-violet-900/40"
                    : "border-white/10 bg-white/[0.03]"
                }`}
              >
                {p.highlighted ? (
                  <span className="rounded-full bg-violet-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                    Önerilen
                  </span>
                ) : null}
                <h3 className="mt-2 text-xl font-semibold">{p.name}</h3>
                <p className="mt-1 text-sm text-slate-400">{p.blurb}</p>
                <p className="mt-4">
                  <span className="text-3xl font-semibold">{p.price}</span>
                  <span className="text-slate-400">{p.period}</span>
                </p>
                <ul className="mt-5 space-y-2">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/panel"
                  className={`mt-6 flex w-full items-center justify-center rounded-xl py-2.5 text-sm font-semibold ${
                    p.highlighted
                      ? "bg-white text-slate-900 hover:bg-violet-100"
                      : "border border-white/15 hover:bg-white/10"
                  }`}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 py-16 text-center">
        <h2 className="text-2xl font-semibold sm:text-3xl">Okula götürmeye hazır demo</h2>
        <p className="mx-auto mt-3 max-w-xl text-slate-400">
          Panel, veli ve öğretmen arayüzleri hazır. Veri yerel demo store&apos;da; sıfırdan
          sıfırlanabilir.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/panel"
            className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold hover:bg-violet-500"
          >
            Yönetim paneli
          </Link>
          <Link
            href="/panel/bildirimler"
            className="rounded-xl border border-white/15 px-5 py-3 text-sm font-medium hover:bg-white/10"
          >
            WhatsApp mesajları
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/10 py-8 text-center text-xs text-slate-500">
        NotaPlan · İlk müşteri:{" "}
        <a href="https://www.niluferacar.com.tr" className="text-violet-300 hover:underline">
          Nilüfer Acar Müzik Akademisi
        </a>{" "}
        · github.com/hidircan
      </footer>
    </div>
  );
}
