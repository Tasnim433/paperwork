import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  size = "default",
}: {
  title: string;
  description?: React.ReactNode;
  size?: "default" | "sm";
}) {
  return (
    <div className={size === "sm" ? "mb-6" : "mb-8"}>
      <h1
        className={cn(
          "leading-tight font-semibold tracking-[-0.03em]",
          size === "sm" ? "text-xl" : "text-2xl desktop:text-[28px]",
        )}
      >
        {title}
      </h1>
      {description && (
        <p
          className={cn(
            "mt-1.5 text-muted-foreground [&_b]:font-medium [&_b]:text-foreground",
            size === "sm" ? "text-[13px]" : "text-[14.5px]",
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}
