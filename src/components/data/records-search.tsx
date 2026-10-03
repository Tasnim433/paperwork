"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

/** Search box that updates `?q=` (debounced) while keeping the other filters. */
export function RecordsSearch({ q, type }: { q: string; type?: string }) {
  const t = useTranslations("records");
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(q);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function update(next: string) {
    setValue(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const params = new URLSearchParams();
      if (type) params.set("type", type);
      if (next.trim()) params.set("q", next.trim());
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }, 250);
  }

  return (
    <label className="flex w-full items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-muted-foreground focus-within:border-ink-2 desktop:w-[280px]">
      <Search className="size-[15px] shrink-0" strokeWidth={1.7} aria-hidden />
      <span className="sr-only">{t("searchLabel")}</span>
      <input
        type="search"
        value={value}
        onChange={(event) => update(event.target.value)}
        placeholder={t("searchPlaceholder")}
        className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
      />
    </label>
  );
}
