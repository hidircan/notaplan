import type {
  InboundWhatsAppMessage,
  OutboundWhatsAppMessage,
  WhatsAppSendResult,
  WhatsAppTransport,
} from "../types";
import { getWhatsAppConfig, normalizePhone } from "../config";

/** Twilio WhatsApp */
export function createTwilioTransport(): WhatsAppTransport {
  const cfg = getWhatsAppConfig();

  return {
    name: "twilio",

    parseInbound(body: unknown): InboundWhatsAppMessage[] {
      // Twilio sends application/x-www-form-urlencoded as object after parse
      const b = body as Record<string, string>;
      const from = (b.From || b.from || "").replace(/^whatsapp:/i, "");
      const text = (b.Body || b.body || "").trim();
      if (!from || !text) return [];
      return [
        {
          id: b.MessageSid || b.SmsMessageSid || `twilio_${Date.now()}`,
          from: normalizePhone(from),
          text,
          timestamp: new Date().toISOString(),
          provider: "twilio",
          raw: body,
        },
      ];
    },

    async sendText(message: OutboundWhatsAppMessage): Promise<WhatsAppSendResult> {
      if (!cfg.twilioAccountSid || !cfg.twilioAuthToken || !cfg.twilioFrom) {
        return { ok: false, error: "Twilio WhatsApp credentials missing" };
      }
      const url = `https://api.twilio.com/2010-04-01/Accounts/${cfg.twilioAccountSid}/Messages.json`;
      const auth = Buffer.from(`${cfg.twilioAccountSid}:${cfg.twilioAuthToken}`).toString(
        "base64"
      );
      const to = message.to.startsWith("whatsapp:")
        ? message.to
        : `whatsapp:+${normalizePhone(message.to)}`;
      const params = new URLSearchParams({
        From: cfg.twilioFrom,
        To: to,
        Body: message.text.slice(0, 1600),
      });
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        });
        const data = (await res.json()) as { sid?: string; message?: string };
        if (!res.ok) {
          return { ok: false, error: data.message || `Twilio HTTP ${res.status}` };
        }
        return { ok: true, messageId: data.sid };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Twilio send failed" };
      }
    },
  };
}
