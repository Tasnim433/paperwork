import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AuthForm } from "@/components/auth/auth-form";
import { PageHeader } from "@/components/page-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.signIn");
  return { title: t("title") };
}

export default async function SignInPage() {
  const t = await getTranslations("auth.signIn");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} size="sm" />
      <AuthForm mode="signIn" />
    </>
  );
}
