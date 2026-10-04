import { and, eq } from "drizzle-orm";

import { db } from "@/server/db";
import { documents } from "@/server/db/schema";
import { getSession } from "@/server/session";
import { storage } from "@/server/storage";

/** Streams the unchanged original of one of the user's documents for the viewer. */
export async function GET(_request: Request, { params }: RouteContext<"/api/documents/[id]/file">) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });

  const doc = await db.query.documents.findFirst({
    where: and(eq(documents.id, id), eq(documents.userId, session.user.id)),
    columns: { storageKey: true, mimeType: true, originalFileName: true },
  });
  if (!doc) return new Response("Not found", { status: 404 });

  const bytes = await storage().get(doc.storageKey);
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(doc.originalFileName)}`,
      // Private user data: never cache in shared caches.
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
