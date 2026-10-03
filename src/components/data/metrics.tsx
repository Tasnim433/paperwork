import { cn } from "@/lib/utils";

export type Metric = { label: string; value: number | string; tone?: "danger" };

/** Row of key numbers separated by thin rules; two columns on mobile. */
export function Metrics({ items }: { items: Metric[] }) {
  return (
    <dl className="mb-11 grid grid-cols-2 border-y border-border desktop:grid-cols-4">
      {items.map((item, i) => (
        <div
          key={item.label}
          className={cn(
            "py-[18px] pl-5",
            // Mobile: 2 columns. Desktop: 4 columns.
            i % 2 === 0 ? "pl-0" : "border-l border-border",
            i >= 2 && "border-t border-border desktop:border-t-0",
            "desktop:border-l desktop:pl-5 desktop:first:border-l-0 desktop:first:pl-0",
          )}
        >
          <dt className="text-[13px] text-muted-foreground">{item.label}</dt>
          <dd
            className={cn(
              "mt-1 text-[30px] font-medium tracking-[-0.03em] tabular-nums",
              item.tone === "danger" && "text-danger",
            )}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
