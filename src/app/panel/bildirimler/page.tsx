import { redirect } from "next/navigation";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { TEMPLATE_CATALOG, buildDemoMessages } from "@/lib/whatsapp-templates";
import { ExternalLink, MessageCircle } from "lucide-react";
import { requireSessionContext } from "@/lib/auth/session";
import { getInstitutionContext, readScopedData } from "@/lib/institution/context";
import { KurumScopeNote } from "@/components/kurum-scope-note";

export const dynamic = "force-dynamic";

export default async function BildirimlerPage() {
  let session;
  try {
    session = await requireSessionContext();
  } catch {
    redirect("/login?next=/panel/bildirimler");
  }
  const kurum = await getInstitutionContext(session);
  const data = await readScopedData(kurum.scope);
  const messages = buildDemoMessages(data);

  return (
    <div>
      <KurumScopeNote scope={kurum.scope} />
      <PageHeader
        title="WhatsApp bildirimleri"
        description="Hazır şablonlar ve canlı veriden üretilmiş mesajlar. wa.me linki ile telefonda WhatsApp açılır (API yok — demo / manuel gönderim)."
      />

      <Card className="mb-6 border-emerald-100 bg-emerald-50/50">
        <div className="flex items-start gap-3">
          <MessageCircle className="mt-0.5 h-5 w-5 text-emerald-700" />
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-50">Nasıl kullanılır?</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              1) Telafi onayla veya yoklama al → 2) Hazır mesajlar bu sayfada birikir → 3) “WhatsApp’ta aç” ile veli/öğretmene gönder.
              Bu sayfa, manuel WhatsApp sürecini düzenli hale getirir.
            </p>
          </div>
        </div>
      </Card>

      <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-50">
        Canlı mesaj kuyruğu ({messages.length})
      </h2>
      {messages.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500 dark:text-slate-400">
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
                    <p className="font-semibold text-slate-900 dark:text-slate-50">{m.title}</p>
                    <Badge>{m.audience}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Kime: {m.toName} · {m.toPhone}
                  </p>
                  <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
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

      <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-50">Şablon kataloğu</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {TEMPLATE_CATALOG.map((t) => (
          <Card key={t.key}>
            <p className="font-semibold text-slate-900 dark:text-slate-50">{t.title}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t.when}</p>
            <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
              {t.sample}
            </pre>
          </Card>
        ))}
      </div>
    </div>
  );
}
