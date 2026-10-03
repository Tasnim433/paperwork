import {
  Archive,
  CircleQuestionMark,
  Clock,
  Inbox,
  LayoutDashboard,
  SlidersHorizontal,
  SquareCheck,
  type LucideIcon,
} from "lucide-react";

export type NavKey = "overview" | "inbox" | "tasks" | "records" | "workDays" | "settings" | "help";

export type NavItem = {
  key: NavKey;
  href: string;
  icon: LucideIcon;
};

export const primaryNav: NavItem[] = [
  { key: "overview", href: "/", icon: LayoutDashboard },
  { key: "inbox", href: "/inbox", icon: Inbox },
  { key: "tasks", href: "/tasks", icon: SquareCheck },
  { key: "records", href: "/records", icon: Archive },
];

export const secondaryNav: NavItem[] = [
  { key: "workDays", href: "/work-days", icon: Clock },
  { key: "settings", href: "/settings", icon: SlidersHorizontal },
];

export const footerNav: NavItem[] = [{ key: "help", href: "/help", icon: CircleQuestionMark }];

export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Breadcrumb trail for a pathname, as nav message keys. Review pages live under the inbox. */
export function breadcrumbFor(pathname: string): Array<NavKey | "review"> {
  const all = [...primaryNav, ...secondaryNav, ...footerNav];
  const item = all.find((entry) => entry.href !== "/" && isActive(pathname, entry.href));
  if (!item) return ["overview"];
  if (item.key === "inbox" && pathname !== "/inbox") return ["inbox", "review"];
  return [item.key];
}
