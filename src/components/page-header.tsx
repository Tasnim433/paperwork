export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl leading-tight font-semibold tracking-[-0.03em] desktop:text-[28px]">
        {title}
      </h1>
      {description && <p className="mt-1.5 text-[14.5px] text-muted-foreground">{description}</p>}
    </div>
  );
}
