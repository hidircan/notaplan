import { AsyncLocalStorage } from "async_hooks";

type TenantStore = { tenantId: string };

const als = new AsyncLocalStorage<TenantStore>();

/** Run work inside a tenant scope (API / web session). */
export function runWithTenant<T>(tenantId: string, fn: () => T): T {
  return als.run({ tenantId }, fn);
}

export async function runWithTenantAsync<T>(
  tenantId: string,
  fn: () => Promise<T>
): Promise<T> {
  return als.run({ tenantId }, fn);
}

/** Required for all tenant-scoped DB operations */
export function requireTenantId(): string {
  const id = als.getStore()?.tenantId;
  if (!id || id === "public") {
    throw new Error("Tenant context missing — authenticate first");
  }
  return id;
}

export function tryTenantId(): string | undefined {
  const id = als.getStore()?.tenantId;
  if (!id || id === "public") return undefined;
  return id;
}
