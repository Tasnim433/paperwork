"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Fragment } from "react";

import { breadcrumbFor } from "./nav-items";

export function Breadcrumb() {
  const pathname = usePathname();
  const tNav = useTranslations("nav");
  const t = useTranslations("topbar");
  const trail = breadcrumbFor(pathname);

  return (
    <nav
      aria-label={t("breadcrumb")}
      className="hidden text-[13px] text-muted-foreground desktop:block"
    >
      {t("workspace")}
      {trail.map((key, i) => (
        <Fragment key={key}>
          {" / "}
          {i === trail.length - 1 ? (
            <span aria-current="page" className="font-medium text-foreground">
              {tNav(key)}
            </span>
          ) : (
            tNav(key)
          )}
        </Fragment>
      ))}
    </nav>
  );
}
