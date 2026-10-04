import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { DocumentDetail } from "@/components/review/document-detail";
import { documentHref } from "@/lib/documents";
import { getDocumentDetail } from "@/server/queries/review";
import { requireSession } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("documentDetail");
  return { title: t("title") };
}

export default async function DocumentPage({ params }: PageProps<"/records/[id]">) {
  const { user } = await requireSession();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const data = await getDocumentDetail(user.id, id);
  if (!data) notFound();

  // Documents not confirmed yet belong to the Inbox / Review.
  const href = documentHref(data.document);
  if (!href.startsWith("/records/")) redirect(href);

  return <DocumentDetail data={data} />;
}
