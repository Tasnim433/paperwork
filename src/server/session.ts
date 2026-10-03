import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "./auth";

/** The current session, or null. Deduplicated per request. */
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

/** The current session; redirects to sign in when there is none. */
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session;
}
