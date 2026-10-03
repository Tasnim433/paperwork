import { useTranslations } from "next-intl";

export function Logo() {
  const t = useTranslations("metadata");
  return (
    <div className="flex items-center gap-2.5 px-2.5 text-[15px] font-semibold tracking-tight">
      <span
        aria-hidden
        className="grid size-[22px] place-items-center rounded-md bg-foreground text-[13px] font-semibold text-background"
      >
        P
      </span>
      {t("appName")}
    </div>
  );
}
