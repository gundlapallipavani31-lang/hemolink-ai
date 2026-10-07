import { BrandMark } from "./BrandMark";
import { MobileMenu } from "./MobileMenu";

const navLinks = [
  ["Platform", "#platform"],
  ["AI Intelligence", "#intelligence"],
  ["How It Works", "#how-it-works"],
  ["For Hospitals", "#roles"],
];

const values = [
  { title: "Real-time coordination", detail: "A shared view for teams moving blood where it is needed.", icon: "↗" },
  { title: "AI-assisted matching", detail: "Surface the right next step across complex availability signals.", icon: "✦" },
  { title: "Emergency response", detail: "Keep urgent requests visible, structured, and ready to act on.", icon: "!" },
  { title: "Smart inventory intelligence", detail: "Turn inventory patterns into clearer operational decisions.", icon: "◌" },
];

const roles = [
  { title: "Hospitals", detail: "Coordinate requests with a clearer view of availability, urgency, and response paths.", icon: "＋" },
  { title: "Blood Banks", detail: "Keep inventory context visible and help partner teams respond with confidence.", icon: "◒" },
  { title: "Donors", detail: "Make it easier to understand where eligible donor support can make a difference.", icon: "♡" },
  { title: "Administrators", detail: "Bring operational signals into one calm, accountable system of record.", icon: "⌘" },
];

function Arrow() {
  return <span aria-hidden="true" className="text-red-200">↗</span>;
}

function AvailabilityPanel() {
  const groups = [
    ["A+", "Stable", "bg-success"],
    ["O−", "Watch", "bg-warning"],
    ["B+", "Ready", "bg-success"],
    ["AB−", "Limited", "bg-medical"],
  ];

  return (
    <div className="relative overflow-hidden rounded-[1.05rem] border border-white/12 bg-white/[0.06] p-4 shadow-lg sm:p-5">
      <div className="absolute -right-16 -top-24 size-64 rounded-full bg-red-300/10 blur-3xl" />
      <div className="relative">
        <div className="mb-7 flex items-start justify-between">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-red-200">Interface preview</p>
            <h3 className="mt-2 text-base font-semibold text-white">Blood intelligence</h3>
          </div>
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[0.65rem] font-medium text-emerald-200">
            <span className="size-1.5 animate-pulse-soft rounded-full bg-emerald-300" /> AI active
          </span>
        </div>
        <div className="mb-4 grid grid-cols-2 gap-2.5">
          {groups.map(([group, status, color]) => (
            <div key={group} className="rounded-xl border border-white/10 bg-white/[0.06] p-3">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-white">{group}</span>
                <span className={`size-2 rounded-full ${color}`} />
              </div>
              <p className="mt-1 text-[0.68rem] text-slate-300">{status} signal</p>
            </div>
          ))}
        </div>
        <div className="relative overflow-hidden rounded-[0.8rem] border border-red-200/15 bg-red-300/[0.08] p-3.5">
          <div className="absolute inset-y-0 left-0 w-1/3 animate-[scan_3.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-red-200/20 to-transparent" />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-[0.68rem] font-medium text-red-200">Emergency response</p>
              <p className="mt-1 text-sm font-semibold text-white">Response paths prepared</p>
            </div>
            <span className="rounded-lg bg-white/10 px-2 py-1 text-[0.65rem] text-slate-200">Preview</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AnalyticsCard() {
  return (
    <div className="rounded-[1.05rem] border border-border bg-surface p-5 shadow-md sm:p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-medical">AI lens</p>
          <h3 className="mt-2 font-semibold text-primary">Signal overview</h3>
        </div>
        <span className="rounded-full bg-soft-rose px-2.5 py-1 text-[0.65rem] font-medium text-primary">Illustrative</span>
      </div>
      <div className="mt-6 flex items-end gap-1.5" aria-label="Illustrative trend chart">
        {[32, 45, 38, 57, 49, 69, 63, 79, 74, 88, 81, 94].map((height, index) => (
          <span key={index} className={`flex-1 rounded-t-sm ${index > 8 ? "bg-medical" : "bg-soft-rose"}`} style={{ height: `${height}px` }} />
        ))}
      </div>
      <div className="mt-3 flex justify-between text-[0.65rem] text-foreground-subtle">
        <span>Pattern baseline</span><span>Forecast signal</span>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 border-t border-border pt-4">
        <div><p className="text-xs text-foreground-subtle">Demand signal</p><p className="mt-1 text-sm font-semibold text-primary">Needs review</p></div>
        <div><p className="text-xs text-foreground-subtle">Shortage risk</p><p className="mt-1 text-sm font-semibold text-warning">Monitored</p></div>
      </div>
    </div>
  );
}

function EmergencyPreview() {
  return (
    <div className="relative rounded-[1.05rem] border border-white/12 bg-[#242222] p-4 shadow-lg sm:p-6">
      <div className="absolute right-0 top-0 h-full w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(180,35,24,0.22),transparent_60%)]" />
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-medical/15 text-medical">!</span>
            <div><p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-red-200">Interface preview</p><p className="mt-1 text-sm font-semibold text-white">Emergency request</p></div>
          </div>
          <span className="rounded-full border border-amber-200/20 bg-amber-200/10 px-2.5 py-1 text-[0.65rem] font-medium text-amber-100">AI priority: high</span>
        </div>
        <div className="grid gap-4 py-5 sm:grid-cols-3">
          <div><p className="text-xs text-slate-400">Blood group</p><p className="mt-1 text-lg font-semibold text-white">O−</p></div>
          <div><p className="text-xs text-slate-400">Required units</p><p className="mt-1 text-lg font-semibold text-white">—</p></div>
          <div><p className="text-xs text-slate-400">Matching status</p><p className="mt-1 text-sm font-semibold text-emerald-300">Paths identified</p></div>
        </div>
        <div className="space-y-2">
          {["Inventory pathway", "Eligible donor pathway", "Partner network pathway"].map((label, index) => (
            <div key={label} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.05] px-3.5 py-3">
              <span className="flex items-center gap-2.5 text-sm text-slate-200"><span className={`size-1.5 rounded-full ${index === 0 ? "bg-emerald-300" : "bg-red-300"}`} />{label}</span>
              <Arrow />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="overflow-hidden bg-background">
      <header className="relative z-20 border-b border-border/70 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
          <a href="#" aria-label="HemoLink AI home"><BrandMark /></a>
          <nav className="hidden items-center gap-7 lg:flex" aria-label="Main navigation">
            {navLinks.map(([label, href]) => <a key={href} href={href} className="text-sm font-medium text-foreground-muted transition hover:text-primary">{label}</a>)}
          </nav>
          <div className="hidden items-center gap-5 lg:flex">
            <a href="#login" className="text-sm font-medium text-foreground-muted transition hover:text-primary">Log in</a>
            <a href="#find-blood" className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-sm">Find Blood <Arrow /></a>
          </div>
          <MobileMenu />
        </div>
      </header>

      <main>
        <section id="platform" className="relative border-b border-border bg-background">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(180,35,24,0.06),transparent_28%),radial-gradient(circle_at_90%_10%,rgba(127,29,29,0.05),transparent_22%)]" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[1.03fr_0.97fr] lg:gap-20 lg:px-10 lg:py-32">
            <div className="animate-slide-up">
              <div className="mb-6 inline-flex items-center gap-2 border-l-2 border-medical pl-3 text-xs font-semibold uppercase tracking-[0.16em] text-foreground-muted"><span className="size-1.5 rounded-full bg-medical" /> Intelligence for the blood network</div>
              <h1 className="max-w-3xl text-4xl font-semibold leading-[1.04] tracking-[-0.06em] text-foreground sm:text-6xl lg:text-[4.5rem]">Intelligent Blood Coordination.<br /><span className="text-primary">When Every Second Matters.</span></h1>
              <p className="mt-7 max-w-xl text-base leading-7 text-foreground-muted sm:text-lg sm:leading-8">HemoLink AI connects hospitals, blood banks, and eligible donors through intelligent matching, demand forecasting, and emergency response.</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <a href="#find-blood" className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-md">Find Blood <Arrow /></a>
                <a href="#become-donor" className="inline-flex items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface px-5 py-3.5 text-sm font-semibold text-primary transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-surface-muted">Become a Donor <span aria-hidden="true">↗</span></a>
              </div>
              <p className="mt-5 text-xs text-foreground-subtle">A coordination platform designed for healthcare teams and eligible donors.</p>
            </div>
            <div className="animate-slide-up [animation-delay:120ms]">
              <div className="relative mx-auto max-w-[34rem] rounded-[1.25rem] bg-[#242222] p-2 shadow-lg sm:p-3">
                    <div className="absolute -inset-4 -z-10 rounded-[1.5rem] bg-red-300/10 blur-2xl" />
                <AvailabilityPanel />
              </div>
            </div>
          </div>
        </section>

        <section aria-label="Platform capabilities" className="border-b border-border bg-surface">
          <div className="mx-auto grid max-w-7xl divide-y divide-border px-5 sm:grid-cols-2 sm:divide-x sm:divide-y-0 sm:px-8 lg:grid-cols-4 lg:px-10">
            {values.map((value) => <div key={value.title} className="group flex gap-4 py-6 sm:px-6 lg:first:pl-0 lg:last:pr-0"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-soft-rose text-sm font-semibold text-primary transition group-hover:bg-[#ead5d2]">{value.icon}</span><div><h2 className="text-sm font-semibold text-foreground">{value.title}</h2><p className="mt-1 text-xs leading-5 text-foreground-subtle">{value.detail}</p></div></div>)}
          </div>
        </section>

        <section id="intelligence" className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-2 lg:gap-24 lg:px-10">
          <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-medical">AI intelligence</p><h2 className="mt-4 max-w-xl text-3xl font-semibold leading-tight tracking-[-0.04em] text-foreground sm:text-5xl">From Blood Inventory to Intelligent Decisions.</h2><p className="mt-6 max-w-lg text-base leading-7 text-foreground-muted">HemoLink AI helps teams see beyond a single request. It brings patterns, priorities, and response options together so people can make more informed decisions.</p><ul className="mt-8 grid gap-4 text-sm text-foreground-muted sm:grid-cols-2">{["Predict upcoming demand", "Identify shortage risks", "Match eligible donors", "Prioritize emergency requests"].map((item) => <li key={item} className="flex items-center gap-3"><span className="flex size-5 items-center justify-center rounded-full bg-emerald-50 text-xs text-success">✓</span>{item}</li>)}</ul></div>
          <AnalyticsCard />
        </section>

        <section id="how-it-works" className="border-y border-border bg-surface-muted">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28 lg:px-10"><div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-medical">How it works</p><h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-5xl">A clearer path from request to response.</h2></div>          <div className="relative mt-14 grid gap-8 md:grid-cols-4 md:gap-4">{[["01", "Request", "Capture what is needed with the context teams need to act."], ["02", "Analyze", "Organize signals across inventory, urgency, and eligibility."], ["03", "Match", "Surface relevant response paths for the right people."], ["04", "Respond", "Keep coordination moving with a shared operational view."]].map(([number, title, detail], index) => <div key={number} className="relative flex gap-4 md:block md:pr-6"><div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-soft-rose text-sm font-semibold text-primary">{number}</div><div className="pt-1 md:pt-5"><h3 className="font-semibold text-foreground">{title}</h3><p className="mt-2 max-w-xs text-sm leading-6 text-foreground-muted">{detail}</p></div>{index < 3 && <span className="absolute left-11 top-11 hidden h-px w-[calc(100%-2rem)] bg-primary/35 md:block" />}</div>)}</div></div>
        </section>

        <section id="roles" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28 lg:px-10"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-medical">Built around the network</p><h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-5xl">One system. Every essential role.</h2></div><p className="max-w-sm text-sm leading-6 text-foreground-muted">Designed to help every participant contribute to a more responsive blood network.</p></div><div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{roles.map((role) => <article key={role.title} className="group rounded-[1.05rem] border border-border bg-surface p-5 shadow-xs transition hover:-translate-y-1 hover:border-primary/30 hover:shadow-md"><span className="flex size-10 items-center justify-center rounded-lg bg-soft-rose text-lg text-primary transition group-hover:-translate-y-0.5">{role.icon}</span><h3 className="mt-7 font-semibold text-foreground">{role.title}</h3><p className="mt-2 text-sm leading-6 text-foreground-muted">{role.detail}</p><a href="#platform" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary">Learn more <Arrow /></a></article>)}</div></section>

        <section className="bg-[#242222] px-5 py-20 sm:px-8 sm:py-28 lg:px-10"><div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-200">Emergency response</p><h2 className="mt-4 max-w-xl text-3xl font-semibold leading-tight tracking-[-0.04em] text-white sm:text-5xl">When Minutes Matter, Intelligence Moves First.</h2><p className="mt-6 max-w-lg text-base leading-7 text-stone-300">A focused command view for urgent coordination. Keep the request, priority, and possible paths together without adding noise.</p><p className="mt-5 text-xs text-stone-400">Illustrative product interface — not a live medical service.</p></div><EmergencyPreview /></div></section>

        <section id="find-blood" className="relative overflow-hidden border-b border-border bg-surface"><div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(180,35,24,0.08),transparent_42%)]" /><div className="relative mx-auto max-w-4xl px-5 py-24 text-center sm:px-8 sm:py-32"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-medical">The next step is clearer</p><h2 className="mx-auto mt-4 max-w-2xl text-4xl font-semibold leading-tight tracking-[-0.05em] text-foreground sm:text-6xl">Build a smarter, more responsive blood network.</h2><div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row"><a href="#platform" className="rounded-lg bg-primary px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-md">Explore HemoLink AI</a><a id="become-donor" href="#roles" className="rounded-lg border border-border-strong bg-surface px-5 py-3.5 text-sm font-semibold text-foreground transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-surface-muted">Become a Donor</a></div></div></section>
      </main>

      <footer className="bg-background"><div className="mx-auto grid max-w-7xl gap-12 px-5 py-14 sm:px-8 md:grid-cols-[1.5fr_1fr_1fr_1fr] lg:px-10"><div><BrandMark /><p className="mt-5 max-w-xs text-sm leading-6 text-foreground-muted">Intelligent coordination for a more responsive blood network.</p></div>{[["Platform", ["Overview", "AI Intelligence", "For Hospitals"]], ["Resources", ["How It Works", "Become a Donor", "Contact"]], ["Company", ["About HemoLink", "Privacy", "Terms"]]].map(([title, items]) => <div key={title as string}><h2 className="text-sm font-semibold text-primary">{title}</h2><ul className="mt-4 grid gap-3">{(items as string[]).map((item) => <li key={item}><a href="#platform" className="text-sm text-foreground-muted transition hover:text-primary">{item}</a></li>)}</ul></div>)}</div><div className="mx-auto flex max-w-7xl flex-col gap-3 border-t border-border px-5 py-5 text-xs text-foreground-subtle sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10"><span>© 2026 HemoLink AI. Thoughtful technology for healthcare coordination.</span><span>Designed for clarity, built for care.</span></div></footer>
    </div>
  );
}
