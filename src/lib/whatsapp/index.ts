export type {
  WhatsAppProviderName,
  InboundWhatsAppMessage,
  OutboundWhatsAppMessage,
  WhatsAppTransport,
} from "./types";
export { getWhatsAppConfig, getWhatsAppProviderName, normalizePhone } from "./config";
export { getWhatsAppTransport } from "./provider-factory";
export { resolveWhatsAppIdentity } from "./phone-map";
export { handleInboundWhatsAppMessage, processWhatsAppWebhook } from "./handler";
