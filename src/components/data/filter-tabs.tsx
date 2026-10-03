import Link from "next/link";

import { cn } from "@/lib/utils";

export type FilterTab = { href: string; label: string; active: boolean };

/** Segmented control made of links, so filters live in the URL and work without JavaScript. */
export function FilterTabs({ label, tabs }: { label: string; tabs: FilterTab[] }) {
  return (
    <nav
      aria-label={label}
      className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-lg bg-line-2 p-0.5"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          scroll={false}
          className={cn(
            "rounded-md px-3 py-[5px] text-[13px] whitespace-nowrap text-ink-2 transition-colors hover:text-foreground",
            tab.active && "bg-background font-medium text-foreground ring-1 ring-border",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
