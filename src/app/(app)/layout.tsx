import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { requireSession } from "@/server/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { user } = await requireSession();

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={{ name: user.name, email: user.email }} />
        <main className="flex-1 px-4 pt-6 pb-12 desktop:px-12 desktop:pt-9 desktop:pb-16">
          <div className="mx-auto max-w-[1080px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
