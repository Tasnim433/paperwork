import { cn } from "@/lib/utils";

export type Metric = {
  label: string;
  value: number | string;
  tone?: "danger";
  /** Optional progress bar under the value (0 to 1), e.g. share of a yearly limit. */
  meter?: { ratio: number; tone: "brand" | "warning" | "danger"; label: string };
};

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
          {item.meter && (
            <dd
              role="meter"
              aria-label={item.label}
              aria-valuemin={0}
              aria-valuemax={1}
              aria-valuenow={Math.min(1, item.meter.ratio)}
              aria-valuetext={item.meter.label}
              className="mt-2.5 mr-5 h-[3px] overflow-hidden rounded-full bg-border"
            >
              <div
                className={cn(
                  "h-full",
                  item.meter.tone === "danger" && "bg-danger",
                  item.meter.tone === "warning" && "bg-warning",
                  item.meter.tone === "brand" && "bg-brand",
                )}
                style={{ width: `${Math.min(100, Math.max(0, item.meter.ratio * 100))}%` }}
              />
            </dd>
          )}
        </div>
      ))}
    </dl>
  );
}
