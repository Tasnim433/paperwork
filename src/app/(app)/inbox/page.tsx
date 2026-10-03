import { getTranslations } from "next-intl/server";

import { InboxTable } from "@/components/data/inbox-table";
import { PageHeader } from "@/components/page-header";
import { pageMetadata } from "@/components/placeholder-page";
import { listInbox } from "@/server/queries/documents";
import { requireSession } from "@/server/session";

export const generateMetadata = () => pageMetadata("inbox");

export default async function InboxPage() {
  const { user } = await requireSession();
  const t = await getTranslations("pages.inbox");
  const documents = await listInbox(user.id);

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <InboxTable documents={documents} />
    </>
  );
}
