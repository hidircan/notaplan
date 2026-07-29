import { PageHeader } from "@/components/ui";
import { ChatPanel } from "@/components/chat-panel";

export const dynamic = "force-dynamic";

export default function PanelChatPage() {
  return (
    <div>
      <PageHeader
        title="AI Asistan"
        description="NotaPlan Agent Runtime ile sohbet edin. Tüm işlemler Tool Registry ve /api/v1/agent/execute katmanından geçer; doğrudan veritabanı erişimi yoktur."
      />
      <ChatPanel />
    </div>
  );
}
