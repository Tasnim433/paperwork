import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { FilterTabs } from "@/components/data/filter-tabs";
import { Metrics } from "@/components/data/metrics";
import { EmptyState, SectionTitle, Table, Td } from "@/components/data/table";
import { WorkDaysChart } from "@/components/data/work-days-chart";
import { PageHeader } from "@/components/page-header";
import { pageMetadata } from "@/components/placeholder-page";
import { StatusDot } from "@/components/status-dot";
import { todayIso } from "@/lib/dates";
import { documentHref } from "@/lib/documents";
import { cn } from "@/lib/utils";
import { availableYears, resolveYear, workDaysSummary, yearsWithData } from "@/lib/work-days";
import { listWorkEntries } from "@/server/queries/work-days";
import { requireSession } from "@/server/session";

export const generateMetadata = () => pageMetadata("workDays");

export default async function WorkDaysPage({ searchParams }: PageProps<"/work-days">) {
  const { user } = await requireSession();
  const t = await getTranslations("workDays");
  const locale = await getLocale();
  const entries = await listWorkEntries(user.id);

  const currentYear = Number(todayIso().slice(0, 4));
  const years = availableYears(entries, currentYear);
  const rawYear = (await searchParams).year;
  const year = resolveYear(rawYear ? Number(rawYear) : null, entries, currentYear);
  const defaultYear = resolveYear(null, entries, currentYear);
  const otherYearsWithData = yearsWithData(entries).filter((value) => value !== year);
  const yearHref = (value: number) =>
    value === defaultYear ? "/work-days" : `/work-days?year=${value}`;
  const summary = workDaysSummary(entries, year);
  const sources = entries.filter((entry) => entry.month.startsWith(`${year}-`)).reverse();

  const number = (value: number) =>
    new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-GB", { maximumFractionDigits: 1 }).format(
      value,
    );
  const percent = Math.round(summary.ratio * 100);
  const monthLabel = (month: string) =>
    new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${month.slice(0, 7)}-01T00:00:00Z`));

  return (
    <>
      <PageHeader title={t("title")} description={t("description", { year })} />

      {years.length > 1 && (
        <div className="mb-6">
          <FilterTabs
            label={t("yearLabel")}
            tabs={years.map((value) => ({
              href: yearHref(value),
              label: String(value),
              active: value === year,
            }))}
          />
        </div>
      )}

      {sources.length === 0 && otherYearsWithData.length > 0 && (
        <p role="status" className="mb-6 rounded-lg border border-border px-4 py-3 text-[13.5px]">
          {t("emptyYear", { year })}{" "}
          {otherYearsWithData.map((value, i) => (
            <span key={value}>
              {i > 0 && ", "}
              <Link
                href={yearHref(value)}
                className="font-medium underline underline-offset-4 hover:no-underline"
              >
                {value}
              </Link>
            </span>
          ))}
        </p>
      )}

      {summary.level !== "ok" && (
        <div
          role="status"
          className={cn(
            "mb-6 flex flex-col gap-1 rounded-lg border px-4 py-3",
            summary.level === "limit" ? "border-danger" : "border-warning",
          )}
        >
          <StatusDot
            tone={summary.level === "limit" ? "danger" : "warning"}
            className="font-medium"
          >
            {summary.level === "limit"
              ? summary.over > 0
                ? t("warnings.over", { over: number(summary.over), limit: summary.limit })
                : t("warnings.limit", { limit: summary.limit })
              : t("warnings.near", { percent, used: number(summary.used), limit: summary.limit })}
          </StatusDot>
          <p className="pl-3.5 text-[13px] text-muted-foreground">
            {summary.level === "limit" ? t("warnings.limitHint") : t("warnings.nearHint")}
          </p>
        </div>
      )}

      <Metrics
        items={[
          { label: t("metrics.full"), value: summary.fullDays },
          { label: t("metrics.half"), value: summary.halfDays },
          {
            label: t("metrics.used"),
            value: `${number(summary.used)} / ${summary.limit}`,
            tone: summary.level === "limit" ? "danger" : undefined,
            meter: {
              ratio: summary.ratio,
              tone:
                summary.level === "limit"
                  ? "danger"
                  : summary.level === "warning"
                    ? "warning"
                    : "brand",
              label: t("meterText", { used: number(summary.used), limit: summary.limit, percent }),
            },
          },
          { label: t("metrics.remaining"), value: number(summary.remaining) },
        ]}
      />
      <div className="grid gap-10 desktop:grid-cols-[1.3fr_1fr]">
        <section className="mb-11">
          <SectionTitle>{t("perMonth")}</SectionTitle>
          <div className="rounded-xl border border-border px-[18px] py-4">
            <WorkDaysChart months={summary.months} year={year} />
          </div>
          <p className="mt-6 max-w-[560px] text-[13px] text-muted-foreground">{t("rule")}</p>
        </section>

        <section className="mb-11">
          <SectionTitle>{t("sources")}</SectionTitle>
          {sources.length === 0 ? (
            <EmptyState>{t("noSources", { year })}</EmptyState>
          ) : (
            <Table>
              <tbody>
                {sources.map((entry) => (
                  <tr key={entry.id}>
                    <Td>
                      {entry.documentId && entry.documentStatus ? (
                        <Link
                          href={documentHref({
                            id: entry.documentId,
                            status: entry.documentStatus,
                          })}
                          className="underline-offset-4 hover:underline"
                        >
                          {t("payslip", { month: monthLabel(entry.month) })}
                        </Link>
                      ) : (
                        t("payslip", { month: monthLabel(entry.month) })
                      )}
                      <div className="text-[12.5px] text-muted-foreground">
                        {entry.sender ?? "—"}
                        {entry.source === "manual" && ` · ${t("manualLabel")}`}
                      </div>
                    </Td>
                    <Td className="text-right whitespace-nowrap tabular-nums">
                      {t("sourceDays", { full: entry.fullDays, half: entry.halfDays })}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </section>
      </div>
    </>
  );
}
