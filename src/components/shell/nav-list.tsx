"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { footerNav, isActive, primaryNav, secondaryNav, type NavItem } from "./nav-items";

const itemClass =
  "flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-sm text-sidebar-foreground transition-colors hover:bg-line-2 hover:text-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground";

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const active = isActive(pathname, item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        itemClass,
        active && "bg-sidebar-accent font-medium text-foreground [&_svg]:text-foreground",
      )}
    >
      <Icon strokeWidth={1.6} aria-hidden />
      {t(item.key)}
    </Link>
  );
}

export function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations("nav");

  return (
    <nav aria-label={t("label")} className="flex flex-1 flex-col gap-px">
      {primaryNav.map((item) => (
        <NavLink key={item.key} item={item} onNavigate={onNavigate} />
      ))}
      <div role="separator" className="mx-2.5 my-2.5 h-px bg-border" />
      {secondaryNav.map((item) => (
        <NavLink key={item.key} item={item} onNavigate={onNavigate} />
      ))}
      <div className="mt-auto flex flex-col gap-px pt-2 [&_a]:text-[13px] [&_a]:text-muted-foreground">
        {footerNav.map((item) => (
          <NavLink key={item.key} item={item} onNavigate={onNavigate} />
        ))}
        {/* Inert until authentication exists. */}
        <button type="button" className={cn(itemClass, "text-[13px] text-muted-foreground")}>
          <LogOut strokeWidth={1.6} aria-hidden />
          {t("signOut")}
        </button>
      </div>
    </nav>
  );
}
