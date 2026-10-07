type AsyncStateProps = {
  title: string;
  description?: string;
};

export function LoadingState({
  title = "Loading",
  description = "Please wait while we prepare this view.",
}: Partial<AsyncStateProps> = {}) {
  return (
    <div className="flex min-h-48 items-center justify-center rounded-[1rem] border border-border bg-surface px-6 py-10 text-center shadow-xs">
      <div>
        <span className="mx-auto flex size-3 animate-pulse-soft rounded-full bg-medical" />
        <p className="mt-4 text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-sm text-foreground-muted">{description}</p>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: AsyncStateProps) {
  return (
    <div className="rounded-[1rem] border border-dashed border-border-strong bg-surface-muted px-6 py-10 text-center">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-foreground-muted">{description}</p>}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description = "Please refresh and try again.",
}: Partial<AsyncStateProps> = {}) {
  return (
    <div role="alert" className="rounded-[1rem] border border-red-200 bg-red-50 px-6 py-5">
      <p className="text-sm font-semibold text-danger">{title}</p>
      <p className="mt-1 text-sm leading-6 text-red-900/70">{description}</p>
    </div>
  );
}
