import Link from "next/link";
import {
  FileText, Zap, ShieldCheck, Clock, Layers, Sparkles,
  ArrowRight, CheckCircle2, HardHat,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Nav */}
      <nav className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500 text-slate-950">
              <HardHat className="h-5 w-5" strokeWidth={2.5} />
            </div>
            BidWright
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="btn-ghost px-4 py-2 text-sm">
              Log in
            </Link>
            <Link href="/auth/register" className="btn-primary px-4 py-2 text-sm">
              Start free trial
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
            <Sparkles className="h-3.5 w-3.5" />
            Built for subcontractors. Not GCs.
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-slate-900 sm:text-6xl">
            Turn a 4-hour ITB into a <span className="text-amber-600">5-minute bid</span>.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-slate-600">
            Drop in the PDF the GC sent you. BidWright reads the scope, pulls the deadlines,
            drafts the exclusions, and writes the clarifications — so you can price it,
            review it, and send it. That&apos;s it.
          </p>
          <div className="mt-10 flex items-center justify-center gap-3">
            <Link href="/auth/register" className="btn-primary px-6 py-3 text-base">
              Start free — 3 bids, no card <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="#how" className="btn-secondary px-6 py-3 text-base">
              See how it works
            </Link>
          </div>
          <div className="mt-8 flex items-center justify-center gap-6 text-sm text-slate-500">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> No credit card</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> 5-min setup</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Cancel anytime</span>
          </div>
        </div>

        {/* Preview card */}
        <div className="mx-auto mt-20 max-w-4xl">
          <div className="card p-2">
            <div className="rounded-lg bg-slate-900 p-8 font-mono text-sm text-slate-300 shadow-inner">
              <div className="mb-3 flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-red-500/60" />
                <span className="h-3 w-3 rounded-full bg-amber-500/60" />
                <span className="h-3 w-3 rounded-full bg-emerald-500/60" />
                <span className="ml-3 text-xs text-slate-500">bidwright — extract downtown-office-electrical.pdf</span>
              </div>
              <div className="space-y-1">
                <div className="text-slate-500">→ Extracting PDF (12 pages)...</div>
                <div className="text-slate-500">→ Reading scope of work...</div>
                <div className="text-slate-500">→ Generating bid response...</div>
                <div className="mt-3 text-emerald-400">✓ Extracted 24 scope items · 8 assumptions · 12 exclusions</div>
                <div className="mt-3 text-slate-300"><span className="text-amber-400">Project:</span> Downtown Office Fitout — Level 3</div>
                <div className="text-slate-300"><span className="text-amber-400">GC:</span> Turner Construction</div>
                <div className="text-slate-300"><span className="text-amber-400">Deadline:</span> 2026-07-28 · <span className="text-amber-500">14 days</span></div>
                <div className="text-slate-300"><span className="text-amber-400">Trade:</span> electrical</div>
                <div className="mt-3 text-yellow-400">⚠ 2 warnings — verify before submitting:</div>
                <div className="text-yellow-300/80"> Panel schedule referenced on p.7 but not attached</div>
                <div className="text-yellow-300/80"> Bond amount unclear — states either 5% or 10%</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="how" className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Everything an estimator does. Faster and with a paper trail.
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Every extracted line shows the source page. Every AI-generated field has a confidence badge.
              Nothing is a black box.
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <Feature
              icon={FileText}
              title="PDF in, structured out"
              body="Scope items, quantities, deadlines, bond and insurance requirements, walkthrough dates — pulled in seconds with source-page provenance."
            />
            <Feature
              icon={ShieldCheck}
              title="Provenance-first"
              body="Every extracted field links back to the exact page in the PDF. Click any line item to jump to where it came from."
            />
            <Feature
              icon={Zap}
              title="Drafted response"
              body="Line items, assumptions, clarifications, and exclusions pre-populated. You fill in pricing, review, and send."
            />
            <Feature
              icon={Clock}
              title="Deadline board"
              body="Every open bid on one dashboard. Countdown to deadline, status, who's working what. No more missed submissions."
            />
            <Feature
              icon={Layers}
              title="Learns your prices"
              body="Every finalized bid feeds your cost history. Next time you bid a similar line, we suggest your own price."
            />
            <Feature
              icon={Sparkles}
              title="Confidence badges"
              body="High-confidence items in green. Ambiguous ones flagged amber. Anything the AI is unsure about, you review first."
            />
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Why BidWright instead of the others?
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Most bid platforms are built for GCs. Subs are an afterthought. We do it the other way around.
          </p>
        </div>

        <div className="mt-12 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-6 py-4 font-medium">Feature</th>
                <th className="px-6 py-4 font-medium text-amber-700">BidWright</th>
                <th className="px-6 py-4 font-medium">Downtobid</th>
                <th className="px-6 py-4 font-medium">BuildingConnected</th>
                <th className="px-6 py-4 font-medium">Excel + email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <ComparisonRow feature="Built for subcontractors" us="✓" a="Both" b="GC-first" c="—" />
              <ComparisonRow feature="AI bid response draft" us="✓" a="Invites only" b="—" c="—" />
              <ComparisonRow feature="Source-page provenance" us="✓" a="—" b="—" c="—" />
              <ComparisonRow feature="Learns your unit prices" us="✓" a="—" b="—" c="Your brain" />
              <ComparisonRow feature="Deadline board" us="✓" a="✓" b="✓" c="—" />
              <ComparisonRow feature="Starting price / month" us="$49" a="$119" b="$300+" c="Free" />
            </tbody>
          </table>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-200 bg-slate-950">
        <div className="mx-auto max-w-6xl px-6 py-24 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Stop losing weekends to bid prep.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-400">
            Three free bids. No credit card. If it saves you time, keep going.
            If it doesn&apos;t, walk away.
          </p>
          <Link href="/auth/register" className="mt-10 inline-flex items-center gap-2 rounded-lg bg-amber-500 px-6 py-3 font-medium text-slate-950 hover:bg-amber-400">
            Start free trial <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8 text-sm text-slate-500">
          <div>© 2026 BidWright. Built by subcontractors, for subcontractors.</div>
          <div className="flex gap-6">
            <Link href="#" className="hover:text-slate-900">Terms</Link>
            <Link href="#" className="hover:text-slate-900">Privacy</Link>
            <Link href="mailto:hello@bidwright.app" className="hover:text-slate-900">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-soft transition-shadow hover:shadow-card">
      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
    </div>
  );
}

function ComparisonRow({
  feature, us, a, b, c,
}: {
  feature: string;
  us: string;
  a: string;
  b: string;
  c: string;
}) {
  return (
    <tr>
      <td className="px-6 py-4 font-medium text-slate-900">{feature}</td>
      <td className="px-6 py-4 font-semibold text-amber-700">{us}</td>
      <td className="px-6 py-4 text-slate-600">{a}</td>
      <td className="px-6 py-4 text-slate-600">{b}</td>
      <td className="px-6 py-4 text-slate-600">{c}</td>
    </tr>
  );
}
