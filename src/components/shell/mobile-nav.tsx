"use client";

import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

import { Logo } from "./logo";
import { NavList } from "./nav-list";

export function MobileNav() {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="desktop:hidden" aria-label={t("openMenu")}>
          <Menu strokeWidth={1.7} />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        aria-describedby={undefined}
        className="w-[260px] gap-0 bg-sidebar px-3 pt-[18px] pb-3.5"
      >
        <SheetTitle className="pt-0.5 pb-[22px]">
          <Logo />
        </SheetTitle>
        <NavList onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
