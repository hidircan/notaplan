import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { readData } from "@/lib/store";
import { requireSessionContext } from "@/lib/auth/session";
import { runWithTenantAsync } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session;
  try {
    session = await requireSessionContext();
  } catch {
    redirect("/login?next=/panel");
  }

  // School staff only for admin panel
  if (session.role === "TEACHER") redirect("/ogretmen");
  if (session.role === "PARENT") redirect("/veli");

  const data = await runWithTenantAsync(session.tenantId, () => readData());

  return (
    <div className="flex min-h-screen">
      <Sidebar
        schoolName={data.settings.name}
        userLabel={session.userId}
        roleLabel={session.role}
      />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">{children}</div>
      </main>
    </div>
  );
}
