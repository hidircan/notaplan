import { readData } from "@/lib/store";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { TEMPLATE_CATALOG, buildDemoMessages } from "@/lib/whatsapp-templates";
import { ExternalLink, MessageCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BildirimlerPage() {
  const data = await readData();
  const messages = buildDemoMessages(data);

  return (
    <div>
      <PageHeader
        title="WhatsApp bildirimleri"
        description="Hazır şablonlar ve canlı veriden üretilmiş mesajlar. wa.me linki ile telefonda WhatsApp açılır (API yok — demo / manuel gönderim)."
      />

      <Card className="mb-6 border-emerald-100 bg-emerald-50/50">
        <div className="flex items-start gap-3">
          <MessageCircle className="mt-0.5 h-5 w-5 text-emerald-700" />
          <div>
            <p className="font-semibold text-slate-900">Nasıl kullanılır?</p>
            <p className="mt-1 text-sm text-slate-600">
              1) Telafi onayla veya yoklama al → 2) Bu sayfada mesaj otomatik listelenir → 3) “WhatsApp’ta
              aç” ile veli/öğretmene gönder. İleride resmi WhatsApp Business API bağlanabilir.
            </p>
          </div>
        </div>
      </Card>

      <h2 className="mb-3 text-lg font-semibold text-slate-900">
        Canlı mesaj kuyruğu ({messages.length})
      </h2>
      {messages.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500">
            Şu an kuyrukta mesaj yok. Telafi oluştur veya gecikmiş ödeme ekle.
          </p>
        </Card>
      ) : (
        <div className="mb-10 space-y-3">
          {messages.map((m, i) => (
            <Card key={`${m.id}-${i}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">{m.title}</p>
                    <Badge>{m.audience}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Kime: {m.toName} · {m.toPhone}
                  </p>
                  <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
                    {m.body}
                  </pre>
                </div>
                <a href={m.waLink} target="_blank" rel="noreferrer">
                  <Button className="whitespace-nowrap bg-emerald-600 hover:bg-emerald-700">
                    <ExternalLink className="h-4 w-4" />
                    WhatsApp’ta aç
                  </Button>
                </a>
              </div>
            </Card>
          ))}
        </div>
      )}

      <h2 className="mb-3 text-lg font-semibold text-slate-900">Şablon kataloğu</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {TEMPLATE_CATALOG.map((t) => (
          <Card key={t.key}>
            <p className="font-semibold text-slate-900">{t.title}</p>
            <p className="mt-1 text-xs text-slate-500">{t.when}</p>
            <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
              {t.sample}
            </pre>
          </Card>
        ))}
      </div>
    </div>
  );
}
