import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export async function generateMetadata() {
  const t = await getTranslations("notFound");
  return { title: t("title") };
}

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <main className="mx-auto max-w-[560px] px-4 py-24">
      <PageHeader title={t("title")} description={t("description")} />
      <Button asChild variant="outline">
        <Link href="/">{t("back")}</Link>
      </Button>
    </main>
  );
}
