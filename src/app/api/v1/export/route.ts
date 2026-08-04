import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api/handler";
import { jsonFail } from "@/lib/api/http";
import { readData } from "@/lib/store";
import { resolveWriteScope, ALL_MODE_WRITE_DENIED_MESSAGE } from "@/lib/institution/write-scope";
import { buildInstitutionExport, EXPORT_ENTITIES, type ExportEntity } from "@/lib/export/institution-export";
import { recordAuditLog } from "@/lib/audit/log";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/export?entity=students — kurumun TEK bir varlık türünü CSV
 * olarak indirir. `readData()` zaten oturum/ALS'e göre tenant-scoped
 * döndüğü için başka bir kurumun tek bir kaydı bile bu yanıta giremez.
 * "Tüm kurumlar" görünümü (SUPER_ADMIN) için de export REDDEDİLİR — mevcut
 * "Tüm kurumlar görünümünde işlem yapılamaz" yazma-engelleme desenine
 * paralel (bkz. `resolveWriteScope`).
 */
export const GET = withApiHandler(
  async ({ ctx, searchParams }) => {
    const scope = await resolveWriteScope(ctx);
    if (scope.mode !== "single") {
      return jsonFail(
        "FORBIDDEN",
        scope.mode === "all" ? ALL_MODE_WRITE_DENIED_MESSAGE : scope.reason
      );
    }

    const entityParam = searchParams.get("entity");
    if (!entityParam || !EXPORT_ENTITIES.includes(entityParam as ExportEntity)) {
      return jsonFail(
        "VALIDATION_ERROR",
        `Geçerli bir 'entity' parametresi gerekli: ${EXPORT_ENTITIES.join(", ")}`
      );
    }
    const entity = entityParam as ExportEntity;

    const data = await readData();
    const files = buildInstitutionExport(data, [entity]);
    const csv = files[entity];

    void recordAuditLog({
      tenantId: scope.tenantId,
      actorUserId: ctx.userId,
      actorRole: ctx.role,
      action: "export.institution_data",
      entityType: "Export",
      entityId: entity,
      outcome: "success",
      meta: { entity, rowCount: csv.split("\r\n").length - 1 },
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${entity}.csv"`,
      },
    });
  },
  { permission: "export:institution" }
);
