import { cn } from "@/lib/utils";

/** Plain table in the mockup style: thin row borders, muted headers, no zebra or shadows. */
export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return <table className={cn("w-full border-collapse text-sm", className)} {...props} />;
}

export function Th({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "border-b border-border px-3 pb-2.5 text-left text-[12.5px] font-normal text-muted-foreground first:pl-0 last:pr-0",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      className={cn(
        "border-b border-border px-3 py-3.5 align-middle first:pl-0 last:pr-0",
        className,
      )}
      {...props}
    />
  );
}

/** Hidden on mobile, like `.hide-m` in the mockup. */
export const desktopOnly = "hidden desktop:table-cell";

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="border-y border-border py-8 text-muted-foreground">{children}</p>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-[15px] font-semibold tracking-[-0.01em]">{children}</h2>;
}
