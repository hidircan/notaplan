import type {
  InboundWhatsAppMessage,
  OutboundWhatsAppMessage,
  WhatsAppSendResult,
  WhatsAppTransport,
} from "../types";
import { getWhatsAppConfig, normalizePhone } from "../config";

/** Evolution API (self-hosted WhatsApp gateway) */
export function createEvolutionTransport(): WhatsAppTransport {
  const cfg = getWhatsAppConfig();

  return {
    name: "evolution",

    parseInbound(body: unknown): InboundWhatsAppMessage[] {
      const b = body as {
        event?: string;
        data?: {
          key?: { remoteJid?: string; id?: string };
          message?: { conversation?: string; extendedTextMessage?: { text?: string } };
          messageTimestamp?: number | string;
        };
        // alternate shapes
        from?: string;
        text?: string;
        id?: string;
      };

      // Generic Evolution message upsert
      const jid = b.data?.key?.remoteJid || "";
      const from = jid.replace(/@.*$/, "");
      const text =
        b.data?.message?.conversation ||
        b.data?.message?.extendedTextMessage?.text ||
        b.text ||
        "";
      if (from && text) {
        return [
          {
            id: b.data?.key?.id || b.id || `evo_${Date.now()}`,
            from: normalizePhone(from),
            text: text.trim(),
            timestamp: b.data?.messageTimestamp
              ? new Date(Number(b.data.messageTimestamp) * 1000).toISOString()
              : new Date().toISOString(),
            provider: "evolution",
            raw: body,
          },
        ];
      }
      return [];
    },

    async sendText(message: OutboundWhatsAppMessage): Promise<WhatsAppSendResult> {
      if (!cfg.evolutionBaseUrl || !cfg.evolutionInstance) {
        return { ok: false, error: "Evolution API credentials missing" };
      }
      const base = cfg.evolutionBaseUrl.replace(/\/$/, "");
      const url = `${base}/message/sendText/${cfg.evolutionInstance}`;
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: cfg.evolutionApiKey,
          },
          body: JSON.stringify({
            number: normalizePhone(message.to),
            text: message.text.slice(0, 4096),
          }),
        });
        if (!res.ok) {
          const t = await res.text();
          return { ok: false, error: t.slice(0, 200) || `Evolution HTTP ${res.status}` };
        }
        const data = (await res.json()) as { key?: { id?: string } };
        return { ok: true, messageId: data.key?.id };
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : "Evolution send failed",
        };
      }
    },
  };
}
