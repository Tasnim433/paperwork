import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "./page-header";

export type PageKey =
  "overview" | "inbox" | "review" | "tasks" | "records" | "workDays" | "settings" | "help";

export async function pageMetadata(page: PageKey): Promise<Metadata> {
  const t = await getTranslations("pages");
  return { title: t(`${page}.title`), description: t(`${page}.description`) };
}

export async function PlaceholderPage({ page }: { page: PageKey }) {
  const t = await getTranslations("pages");
  return (
    <>
      <PageHeader title={t(`${page}.title`)} description={t(`${page}.description`)} />
      <p className="border-y border-border py-8 text-muted-foreground">{t("placeholder")}</p>
    </>
  );
}
