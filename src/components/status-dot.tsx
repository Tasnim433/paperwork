import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const statusDotVariants = cva(
  "inline-flex items-center gap-2 text-[13px] whitespace-nowrap text-ink-2 before:size-1.5 before:shrink-0 before:rounded-full before:content-['']",
  {
    variants: {
      tone: {
        neutral: "before:bg-neutral-dot",
        success: "before:bg-success",
        warning: "before:bg-warning",
        danger: "text-danger before:bg-danger",
        brand: "before:bg-brand",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

/** Status = small colored dot + text. */
export function StatusDot({
  tone,
  className,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof statusDotVariants>) {
  return <span className={cn(statusDotVariants({ tone }), className)} {...props} />;
}
