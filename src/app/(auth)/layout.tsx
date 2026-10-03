import { redirect } from "next/navigation";

import { LanguageSwitch } from "@/components/shell/language-switch";
import { Logo } from "@/components/shell/logo";
import { ThemeSwitch } from "@/components/shell/theme-switch";
import { getSession } from "@/server/session";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getSession()) redirect("/");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-[60px] items-center justify-between px-4 desktop:px-12">
        <Logo />
        <div className="flex items-center gap-1">
          <ThemeSwitch />
          <LanguageSwitch />
        </div>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-12 pb-24 desktop:pt-20">
        <div className="w-full max-w-[380px] rounded-xl border border-border p-6 desktop:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
