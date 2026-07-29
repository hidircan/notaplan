import { redirect } from "next/navigation";
import { getSessionContext, homePathForRole } from "@/lib/auth/session";
import { LoginForm } from "@/components/login-form";

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
    <div className="flex min-h-screen items-center justify-center bg-[#0a0612] px-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl shadow-violet-900/30">
        <div className="mb-6 text-center">
          <p className="text-sm font-medium text-violet-300">NotaPlan</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Giriş yap</h1>
          <p className="mt-2 text-sm text-slate-400">
            Okul yönetimi, öğretmen ve veli portalları için oturum açın.
          </p>
        </div>
        <LoginForm nextPath={params.next} />
        <p className="mt-6 text-center text-[11px] text-slate-500">
          Demo: admin@niluferacar.com.tr / demo-admin
        </p>
      </div>
    </div>
  );
}
