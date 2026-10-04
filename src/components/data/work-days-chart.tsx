import { getLocale, getTranslations } from "next-intl/server";

import type { MonthTotals } from "@/lib/work-days";

const CHART_HEIGHT = 160;

function monthNames(locale: string, width: "short" | "long") {
  const format = new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", {
    month: width,
    timeZone: "UTC",
  });
  return Array.from({ length: 12 }, (_, i) => format.format(new Date(Date.UTC(2026, i, 1))));
}

const number = (value: number, locale: string) =>
  new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-GB", { maximumFractionDigits: 1 }).format(
    value,
  );

/**
 * Monthly stacked bars in full-day equivalents: full days (brand) at the base,
 * half days counted as half (brand tint) on top. One hue, two validated steps;
 * hover or focus a month for its numbers. A table carries the same data for
 * screen readers.
 */
export async function WorkDaysChart({ months, year }: { months: MonthTotals[]; year: number }) {
  const t = await getTranslations("workDays.chart");
  const locale = await getLocale();
  const short = monthNames(locale, "short");
  const long = monthNames(locale, "long");
  // Round the scale up to a multiple of 5 so bars of small months stay visible.
  const max = Math.max(5, Math.ceil(Math.max(...months.map((m) => m.used)) / 5) * 5);
  const px = (value: number) => (value / max) * CHART_HEIGHT;

  return (
    <figure className="m-0">
      <div
        className="grid grid-cols-12 items-end gap-1.5 border-b border-border pt-6 desktop:gap-2.5"
        style={{ height: CHART_HEIGHT + 24 + 6 }}
        aria-hidden
      >
        {months.map((m, i) => {
          const fullHeight = px(m.fullDays);
          const halfHeight = px(m.halfDays / 2);
          return (
            <div
              key={m.month}
              tabIndex={m.used > 0 ? 0 : -1}
              className="group relative flex h-full flex-col items-center justify-end gap-1.5 outline-none"
            >
              {m.used > 0 && (
                <span className="text-[11.5px] text-ink-2 tabular-nums">
                  {number(m.used, locale)}
                </span>
              )}
              <div className="flex w-full max-w-[22px] flex-col gap-[2px]">
                {halfHeight > 0 && (
                  <div
                    className="rounded-t-[4px] bg-brand-tint"
                    style={{ height: Math.max(halfHeight, 2) }}
                  />
                )}
                {fullHeight > 0 && (
                  <div
                    className={halfHeight > 0 ? "bg-brand" : "rounded-t-[4px] bg-brand"}
                    style={{ height: Math.max(fullHeight, 2) }}
                  />
                )}
              </div>
              {m.used > 0 && (
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 hidden w-max -translate-x-1/2 rounded-md border border-border bg-popover px-2.5 py-1.5 text-left text-xs text-popover-foreground group-hover:block group-focus-visible:block">
                  <p className="font-medium">
                    {long[i]} {year}
                  </p>
                  <p className="text-ink-2">{t("full", { count: m.fullDays })}</p>
                  <p className="text-ink-2">{t("half", { count: m.halfDays })}</p>
                  <p className="text-ink-2">{t("used", { value: number(m.used, locale) })}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 grid grid-cols-12 gap-1.5 desktop:gap-2.5" aria-hidden>
        {short.map((name) => (
          <span key={name} className="truncate text-center text-[11.5px] text-muted-foreground">
            {name}
          </span>
        ))}
      </div>
      <figcaption className="mt-5 flex flex-wrap gap-[18px] text-[12.5px] text-muted-foreground">
        <span className="inline-flex items-center gap-[7px]">
          <span className="size-2 rounded-[2px] bg-brand" />
          {t("legendFull")}
        </span>
        <span className="inline-flex items-center gap-[7px]">
          <span className="size-2 rounded-[2px] bg-brand-tint" />
          {t("legendHalf")}
        </span>
      </figcaption>

      <table className="sr-only">
        <caption>{t("tableCaption", { year })}</caption>
        <thead>
          <tr>
            <th scope="col">{t("month")}</th>
            <th scope="col">{t("legendFull")}</th>
            <th scope="col">{t("legendHalf")}</th>
            <th scope="col">{t("usedColumn")}</th>
          </tr>
        </thead>
        <tbody>
          {months.map((m, i) => (
            <tr key={m.month}>
              <th scope="row">{long[i]}</th>
              <td>{m.fullDays}</td>
              <td>{m.halfDays}</td>
              <td>{number(m.used, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
