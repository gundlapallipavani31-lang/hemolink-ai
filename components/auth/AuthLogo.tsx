import Link from "next/link";

export function AuthLogo() {
  return (
    <Link href="/" aria-label="HemoLink AI home" className="inline-flex items-center gap-2.5">
      <span className="relative flex size-9 items-center justify-center rounded-[0.7rem] bg-primary text-white shadow-xs">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 3.8c-2.9 3.5-5.6 6.6-5.6 10.2A5.6 5.6 0 0 0 12 19.6a5.6 5.6 0 0 0 5.6-5.6C17.6 10.4 14.9 7.3 12 3.8Z" />
          <path d="M8.7 14.2a3.3 3.3 0 0 0 3.3 3.3" strokeLinecap="round" />
        </svg>
        <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-medical ring-2 ring-background" />
      </span>
      <span className="text-[1.05rem] font-semibold tracking-[-0.03em] text-foreground">
        HemoLink <span className="text-medical">AI</span>
      </span>
    </Link>
  );
}
