import type { ServiceContext } from "../services/context";
import { getInstitutionContext } from "./context";

export type WriteScope =
  | { mode: "single"; tenantId: string }
  | { mode: "all"; reason: string }
  | { mode: "denied"; reason: string };

export const ALL_MODE_WRITE_DENIED_MESSAGE =
  "Tüm kurumlar görünümünde işlem yapılamaz. Lütfen önce tek bir kurum seçin.";

const NO_ACCESS_MESSAGE = "Bu kuruma erişiminiz yok.";

/**
 * Bir mutasyonun hangi kurumda çalışacağını, TAZE oturum + cookie okumasıyla
 * sunucu tarafında çözer. İstemciden gelen hiçbir kurum/tenant id'sine asla
 * güvenilmez — `getInstitutionContext` zaten `pickInstitutionSelection` ile
 * yalnızca `ctx.role`/`ctx.tenantId`'den türetilen `available` listesindeki
 * kurumları geçerli sayar (bkz. scope.ts); burada ayrıca bir savunma
 * katmanı olarak aynı kontrol tekrarlanır. "Tüm kurumlar" görünümü her
 * zaman salt okunurdur — hiçbir yazma işlemi bu modda çalışmaz.
 */
export async function resolveWriteScope(ctx: ServiceContext): Promise<WriteScope> {
  const { available, scope } = await getInstitutionContext(ctx);

  if (scope.mode === "all") {
    return { mode: "all", reason: ALL_MODE_WRITE_DENIED_MESSAGE };
  }

  const allowed = available.some((k) => k.tenantId === scope.tenantId);
  if (!allowed) {
    return { mode: "denied", reason: NO_ACCESS_MESSAGE };
  }

  return { mode: "single", tenantId: scope.tenantId };
}

/** withAuthContext'in yazma-kapsamı reddinde fırlattığı işaretli hata — çağıranlar bunu UNAUTHENTICATED gibi özel olarak yakalayıp kullanıcıya asıl mesajı gösterebilir. */
export class WriteScopeDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WriteScopeDeniedError";
  }
}
