"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";

import { authClient } from "@/lib/auth-client";

export function SignOutButton({ className }: { className?: string }) {
  const t = useTranslations("nav");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className={className}
      onClick={() =>
        startTransition(async () => {
          await authClient.signOut();
          router.replace("/sign-in");
          router.refresh();
        })
      }
    >
      <LogOut strokeWidth={1.6} aria-hidden />
      {t("signOut")}
    </button>
  );
}
