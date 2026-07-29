import type {
  InboundWhatsAppMessage,
  OutboundWhatsAppMessage,
  WhatsAppSendResult,
  WhatsAppTransport,
} from "../types";
import { normalizePhone } from "../config";

/** Dev/fallback transport — logs outbound messages */
export const consoleTransport: WhatsAppTransport = {
  name: "console",

  parseInbound(body: unknown): InboundWhatsAppMessage[] {
    const b = body as Record<string, unknown>;
    if (!b || typeof b !== "object") return [];
    // Generic test payload: { from, text }
    if (typeof b.from === "string" && typeof b.text === "string") {
      return [
        {
          id: String(b.id || `console_${Date.now()}`),
          from: normalizePhone(b.from),
          text: b.text,
          timestamp: new Date().toISOString(),
          provider: "console",
          raw: body,
        },
      ];
    }
    return [];
  },

  async sendText(message: OutboundWhatsAppMessage): Promise<WhatsAppSendResult> {
    process.stdout.write(
      `[whatsapp:console] → ${message.to}: ${message.text.slice(0, 500)}\n`
    );
    return { ok: true, messageId: `console_out_${Date.now()}` };
  },
};
