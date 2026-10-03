import { Logo } from "./logo";
import { NavList } from "./nav-list";

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 pt-[18px] pb-3.5 desktop:flex">
      <div className="pt-0.5 pb-[22px]">
        <Logo />
      </div>
      <NavList />
    </aside>
  );
}
