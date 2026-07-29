import { getWhatsAppTransport, processWhatsAppWebhook } from "@/lib/whatsapp";
import { getWhatsAppConfig } from "@/lib/whatsapp/config";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/whatsapp/webhook
 * Meta Cloud API verification challenge.
 */
export async function GET(request: Request) {
  const transport = getWhatsAppTransport();
  const url = new URL(request.url);
  if (transport.verifyWebhook) {
    const challenge = transport.verifyWebhook(url.searchParams);
    if (challenge !== null) {
      return new Response(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }
  }
  // Generic health for other providers
  const cfg = getWhatsAppConfig();
  if (url.searchParams.get("hub.verify_token") === cfg.verifyToken) {
    return new Response(url.searchParams.get("hub.challenge") || "ok", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return new Response("Forbidden", { status: 403 });
}

/**
 * POST /api/v1/whatsapp/webhook
 * Inbound messages (Meta / Twilio / Evolution / console test payload).
 * Public endpoint — authenticated via phone → parent map, not JWT.
 */
export async function POST(request: Request) {
  const cfg = getWhatsAppConfig();
  const secret = request.headers.get("x-webhook-secret") || "";
  if (cfg.webhookSecret && secret !== cfg.webhookSecret) {
    // Optional shared secret; Meta uses signature verification in production upgrades
    if (cfg.provider !== "meta") {
      return Response.json(
        { ok: false, error: { code: "UNAUTHORIZED", message: "Invalid webhook secret" } },
        { status: 401 }
      );
    }
  }

  let body: unknown;
  const contentType = request.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const form = await request.formData();
      const obj: Record<string, string> = {};
      form.forEach((v, k) => {
        obj[k] = String(v);
      });
      body = obj;
    } else {
      body = await request.json();
    }
  } catch {
    return Response.json(
      { ok: false, error: { code: "VALIDATION_ERROR", message: "Invalid body" } },
      { status: 400 }
    );
  }

  const result = await processWhatsAppWebhook(body, request.headers);

  // Meta expects 200 quickly
  return Response.json({
    ok: true,
    data: {
      processed: result.processed,
      errors: result.errors,
      provider: getWhatsAppConfig().provider,
    },
  });
}
