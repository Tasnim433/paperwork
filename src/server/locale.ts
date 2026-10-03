"use server";

import { cookies } from "next/headers";

import { isLocale, localeCookieName } from "@/i18n/config";

/** Stores the UI language in a cookie. Setting a cookie in a server action re-renders the current route. */
export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(localeCookieName, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
