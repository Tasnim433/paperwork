import { z } from "zod";

const optional = z
  .string()
  .optional()
  .transform((value) => value?.trim() || undefined);

const schema = z
  .object({
    DATABASE_URL: z.url(),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
    /** Extra origins allowed to call the auth API, comma-separated (e.g. a LAN address in dev). */
    BETTER_AUTH_TRUSTED_ORIGINS: z
      .string()
      .optional()
      .transform((value) =>
        (value ?? "")
          .split(",")
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),

    // Storage of original files.
    STORAGE_DRIVER: z.enum(["local", "r2"]).default("local"),
    LOCAL_STORAGE_DIR: z.string().default(".data/uploads"),
    R2_ACCOUNT_ID: optional,
    R2_ACCESS_KEY_ID: optional,
    R2_SECRET_ACCESS_KEY: optional,
    R2_BUCKET: optional,

    // AI provider for classification, extraction and summaries.
    /** "mock" returns fixed results for fixtures/letters without any API call (tests, offline dev). */
    AI_PROVIDER: z.enum(["google", "anthropic", "mock"]).default("google"),
    /** Overrides the provider's default model. */
    AI_MODEL: optional,
    GOOGLE_GENERATIVE_AI_API_KEY: optional,
    ANTHROPIC_API_KEY: optional,

    /** Directory for OCR language data (downloaded once). */
    TESSERACT_CACHE_DIR: z.string().default(".data/tesseract"),
  })
  .superRefine((env, ctx) => {
    if (env.STORAGE_DRIVER === "r2") {
      for (const key of [
        "R2_ACCOUNT_ID",
        "R2_ACCESS_KEY_ID",
        "R2_SECRET_ACCESS_KEY",
        "R2_BUCKET",
      ] as const) {
        if (!env[key])
          ctx.addIssue({ code: "custom", path: [key], message: "Required when STORAGE_DRIVER=r2" });
      }
    }
    const keyByProvider = {
      google: "GOOGLE_GENERATIVE_AI_API_KEY",
      anthropic: "ANTHROPIC_API_KEY",
    } as const;
    const aiKey = env.AI_PROVIDER === "mock" ? null : keyByProvider[env.AI_PROVIDER];
    if (aiKey && !env[aiKey]) {
      ctx.addIssue({
        code: "custom",
        path: [aiKey],
        message: `Required when AI_PROVIDER=${env.AI_PROVIDER}`,
      });
    }
  });

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(
    `Invalid environment variables:\n${z.prettifyError(parsed.error)}\nSee .env.example.`,
  );
}

export const env = parsed.data;
