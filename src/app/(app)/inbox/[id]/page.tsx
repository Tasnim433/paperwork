import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { pageMetadata } from "@/components/placeholder-page";
import { ReviewScreen } from "@/components/review/review-screen";
import { Button } from "@/components/ui/button";
import { getReviewDocument } from "@/server/queries/review";
import { requireSession } from "@/server/session";

export const generateMetadata = () => pageMetadata("review");

export default async function ReviewPage({ params }: PageProps<"/inbox/[id]">) {
  const { user } = await requireSession();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const data = await getReviewDocument(user.id, id);
  if (!data) notFound();

  if (data.document.status !== "needs_review") {
    const t = await getTranslations("review.notReviewable");
    return (
      <>
        <PageHeader title={t("title")} description={t("description")} />
        <Button asChild variant="outline">
          <Link href="/inbox">{t("back")}</Link>
        </Button>
      </>
    );
  }

  // Keyed by document so the form state resets when moving through the queue.
  return <ReviewScreen key={data.document.id} data={data} />;
}
