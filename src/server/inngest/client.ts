import { eventType, Inngest } from "inngest";
import { z } from "zod";

/** Locally this talks to the Inngest dev server (INNGEST_DEV=1); no account needed. */
export const inngest = new Inngest({ id: "paperwork" });

/** Sent after an upload and on retry; starts the processing pipeline. */
export const documentUploaded = eventType("document/uploaded", {
  schema: z.object({ documentId: z.uuid(), userId: z.string().min(1) }),
});
