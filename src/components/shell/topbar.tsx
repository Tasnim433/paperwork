import { Search, User } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

import { Breadcrumb } from "./breadcrumb";
import { LanguageSwitch } from "./language-switch";
import { MobileNav } from "./mobile-nav";
import { ThemeSwitch } from "./theme-switch";

export function Topbar() {
  const t = useTranslations("topbar");

  return (
    <header className="sticky top-0 z-10 flex h-[60px] items-center gap-2 border-b border-border bg-background/90 px-4 backdrop-blur-sm desktop:gap-3 desktop:px-12">
      <MobileNav />
      <Breadcrumb />
      <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-muted-foreground focus-within:border-ink-2 desktop:ml-auto desktop:w-[300px] desktop:flex-none">
        <Search className="size-[15px] shrink-0" strokeWidth={1.7} aria-hidden />
        <span className="sr-only">{t("searchLabel")}</span>
        <input
          type="search"
          placeholder={t("searchPlaceholder")}
          className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
        />
      </label>
      <Button asChild size="sm">
        <Link href="/inbox">{t("upload")}</Link>
      </Button>
      <ThemeSwitch />
      <LanguageSwitch />
      <Avatar className="size-[30px]" aria-label={t("account")}>
        <AvatarFallback className="bg-border text-foreground">
          <User className="size-4" strokeWidth={1.7} aria-hidden />
        </AvatarFallback>
      </Avatar>
    </header>
  );
}
