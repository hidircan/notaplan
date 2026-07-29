import { withApiHandler } from "@/lib/api/handler";
import { STORE_MODE } from "@/lib/config";
import { ok } from "@/lib/services/result";

export const dynamic = "force-dynamic";

/** GET /api/v1/health — public liveness */
export const GET = withApiHandler(
  async () => {
    return ok({
      service: "notaplan",
      version: "v1",
      storeMode: STORE_MODE,
      time: new Date().toISOString(),
    });
  },
  { public: true }
);
