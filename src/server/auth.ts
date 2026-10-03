import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { defaultLocale, localeFromCookieHeader } from "@/i18n/config";

import { db } from "./db";
import * as schema from "./db/schema";
import { env } from "./env";

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, { provider: "pg", schema, usePlural: true }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user, ctx) => {
          const locale = localeFromCookieHeader(ctx?.headers?.get("cookie")) ?? defaultLocale;
          await db
            .insert(schema.userSettings)
            .values({ userId: user.id, locale })
            .onConflictDoNothing();
        },
      },
    },
  },
  // Must be last: sets cookies from server actions.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
