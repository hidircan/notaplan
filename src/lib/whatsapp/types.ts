export type WhatsAppProviderName = "meta" | "twilio" | "evolution" | "console";

export type InboundWhatsAppMessage = {
  id: string;
  from: string; // phone digits
  text: string;
  timestamp: string;
  provider: WhatsAppProviderName;
  raw?: unknown;
};

export type OutboundWhatsAppMessage = {
  to: string;
  text: string;
};

export type WhatsAppSendResult = {
  ok: boolean;
  messageId?: string;
  error?: string;
};

export interface WhatsAppTransport {
  name: WhatsAppProviderName;
  /** Parse provider-specific webhook body into normalized inbound messages */
  parseInbound(body: unknown, headers?: Headers): InboundWhatsAppMessage[];
  /** Send plain text reply */
  sendText(message: OutboundWhatsAppMessage): Promise<WhatsAppSendResult>;
  /** Optional Meta verify challenge */
  verifyWebhook?(query: URLSearchParams): string | null;
}
