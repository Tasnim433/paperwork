"use server";

import { cookies } from "next/headers";

import { isLocale, localeCookieName } from "@/i18n/config";

import { db } from "./db";
import { userSettings } from "./db/schema";
import { getSession } from "./session";

/**
 * Stores the UI language in a cookie (used for rendering) and, when signed in, in the
 * user's settings. Setting a cookie in a server action re-renders the current route.
 */
export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(localeCookieName, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  const session = await getSession();
  if (session) {
    await db
      .insert(userSettings)
      .values({ userId: session.user.id, locale })
      .onConflictDoUpdate({ target: userSettings.userId, set: { locale } });
  }
}
