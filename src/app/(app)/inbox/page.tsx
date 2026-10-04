import { getTranslations } from "next-intl/server";

import { AutoRefresh } from "@/components/data/auto-refresh";
import { InboxTable } from "@/components/data/inbox-table";
import { PageHeader } from "@/components/page-header";
import { pageMetadata } from "@/components/placeholder-page";
import { DropZone } from "@/components/upload/drop-zone";
import { activeStatuses, listInbox } from "@/server/queries/documents";
import { requireSession } from "@/server/session";

export const generateMetadata = () => pageMetadata("inbox");

export default async function InboxPage() {
  const { user } = await requireSession();
  const t = await getTranslations("pages.inbox");
  const documents = await listInbox(user.id);
  const processing = documents.some((doc) =>
    (activeStatuses as readonly string[]).includes(doc.status),
  );

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <DropZone />
      <InboxTable documents={documents} selectable />
      <AutoRefresh active={processing} />
    </>
  );
}
