import type { WhatsAppTransport } from "./types";
import { getWhatsAppProviderName } from "./config";
import { consoleTransport } from "./providers/console";
import { createMetaTransport } from "./providers/meta";
import { createTwilioTransport } from "./providers/twilio";
import { createEvolutionTransport } from "./providers/evolution";

/** Interchangeable WhatsApp transport from WHATSAPP_PROVIDER env */
export function getWhatsAppTransport(): WhatsAppTransport {
  const name = getWhatsAppProviderName();
  switch (name) {
    case "meta":
      return createMetaTransport();
    case "twilio":
      return createTwilioTransport();
    case "evolution":
      return createEvolutionTransport();
    case "console":
    default:
      return consoleTransport;
  }
}
