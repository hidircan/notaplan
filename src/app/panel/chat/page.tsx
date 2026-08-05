import { PageHeader } from "@/components/ui";
import { OpenAssistantCta } from "@/components/ai/open-assistant-cta";
import { Bot } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * The chat experience moved off this dedicated page and into a floating,
 * app-wide assistant (bottom-right on every screen). This route stays alive
 * — for bookmarks/back-navigation/AI log links (`/panel/ai/logs` labels its
 * history with this path) — and now just opens the same assistant panel.
 */
export default function PanelChatPage() {
  return (
    <div>
      <PageHeader
        title="AI Asistan"
        description="Sohbet artık her sayfada, sağ alt köşedeki simgeden erişilebilir — bu sayfa yalnızca aynı asistanı açar."
      />
      <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center dark:border-slate-700 dark:bg-slate-900/50">
        <Bot className="h-10 w-10 text-amber-400" />
        <p className="max-w-sm text-sm text-slate-600 dark:text-slate-300">
          NotaPlan Asistan artık her ekranda kullanılabilir; hangi öğrenci, öğretmen veya
          program sayfasındaysanız oradan da bağlam alır. Aşağıdaki butonla açabilirsiniz.
        </p>
        <OpenAssistantCta label="Asistanı aç" />
      </div>
    </div>
  );
}
