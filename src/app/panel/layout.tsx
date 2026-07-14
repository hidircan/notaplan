import { Sidebar } from "@/components/sidebar";
import { readData } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const data = await readData();

  return (
    <div className="flex min-h-screen">
      <Sidebar schoolName={data.settings.name} />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">{children}</div>
      </main>
    </div>
  );
}
