import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { defaultLocale, isLocale, localeCookieName, matchAcceptLanguage, timeZone } from "./config";

export default getRequestConfig(async () => {
  const cookieLocale = (await cookies()).get(localeCookieName)?.value;
  const locale = isLocale(cookieLocale)
    ? cookieLocale
    : (matchAcceptLanguage((await headers()).get("accept-language")) ?? defaultLocale);

  return {
    locale,
    timeZone,
    messages: (await import(`../../messages/${locale}.json`)).default,
    formats: {
      dateTime: {
        short: { day: "2-digit", month: "2-digit", year: "numeric" },
        long: { day: "numeric", month: "long", year: "numeric" },
      },
      number: {
        currency: { style: "currency", currency: "EUR" },
      },
    },
  };
});
