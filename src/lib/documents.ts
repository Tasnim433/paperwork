/** Where a document opens: Review while it waits for review, otherwise its read-only page. */
export function documentHref(document: { id: string; status: string }): string {
  if (document.status === "needs_review") return `/inbox/${document.id}`;
  if (document.status === "confirmed" || document.status === "information_only") {
    return `/records/${document.id}`;
  }
  return "/inbox";
}
