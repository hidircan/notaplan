import { redirect } from "next/navigation";
import Image from "next/image";
import { getSessionContext, homePathForRole } from "@/lib/auth/session";
import { LoginForm } from "@/components/login-form";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await getSessionContext();
  const params = await searchParams;
  if (session) {
    redirect(params.next || homePathForRole(session.role));
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4">
      <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-[var(--shadow-md)]">
        <div className="mb-6 text-center">
          <Image
            src={BRAND.logoMarkPath}
            alt={BRAND.name}
            width={56}
            height={44}
            className="mx-auto mb-2 h-11 w-auto"
            priority
          />
          <p className="text-sm font-medium text-[var(--color-primary)]">{BRAND.name}</p>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--color-text)]">Giriş yap</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Okul yönetimi, öğretmen ve veli portalları için oturum açın.
          </p>
        </div>
        <LoginForm nextPath={params.next} />
      </div>
    </div>
  );
}
