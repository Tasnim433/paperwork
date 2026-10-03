"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

type Mode = "signIn" | "signUp";

type ErrorKey =
  | "invalidCredentials"
  | "userExists"
  | "passwordTooShort"
  | "invalidEmail"
  | "tooManyRequests"
  | "generic";

function errorKey(error: { code?: string; status?: number }): ErrorKey {
  if (error.status === 429) return "tooManyRequests";
  switch (error.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "invalidCredentials";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "userExists";
    case "PASSWORD_TOO_SHORT":
      return "passwordTooShort";
    case "INVALID_EMAIL":
      return "invalidEmail";
    default:
      return "generic";
  }
}

export function AuthForm({ mode }: { mode: Mode }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [error, setError] = useState<ErrorKey | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");
    const name = String(data.get("name") ?? "");

    setError(null);
    startTransition(async () => {
      const result =
        mode === "signUp"
          ? await authClient.signUp.email({ name, email, password })
          : await authClient.signIn.email({ email, password });

      if (result.error) {
        setError(errorKey(result.error));
        return;
      }
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {mode === "signUp" && (
        <Field label={t("name")} htmlFor="name">
          <Input id="name" name="name" autoComplete="name" required />
        </Field>
      )}
      <Field label={t("email")} htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field
        label={t("password")}
        htmlFor="password"
        hint={mode === "signUp" ? t("passwordHint") : undefined}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "signUp" ? "new-password" : "current-password"}
          minLength={8}
          required
        />
      </Field>

      {error && (
        <p role="alert" className="text-[13px] text-danger">
          {t(`errors.${error}`)}
        </p>
      )}

      <Button type="submit" disabled={pending} className="mt-1 h-9">
        {t(`${mode}.submit`)}
      </Button>

      <p className="text-[13px] text-muted-foreground">
        {t(`${mode}.switchPrompt`)}{" "}
        <Link
          href={mode === "signUp" ? "/sign-in" : "/sign-up"}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {t(`${mode}.switchLink`)}
        </Link>
      </p>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] text-ink-2">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
