import Link from "next/link";
import { HardHat, CheckCircle2 } from "lucide-react";

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500 text-slate-950">
            <HardHat className="h-5 w-5" strokeWidth={2.5} />
          </div>
          BidWright
        </Link>

        <div className="card p-8">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Start free trial</h1>
          <p className="mt-1 text-sm text-slate-500">3 bids free. No credit card required.</p>

          <form className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Company name
              </label>
              <input className="input" placeholder="Foti Electric" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Primary trade
              </label>
              <select className="input">
                <option>Electrical</option>
                <option>Plumbing</option>
                <option>HVAC / Mechanical</option>
                <option>Drywall / Framing</option>
                <option>Concrete</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Work email
              </label>
              <input type="email" className="input" placeholder="you@company.com" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Password
              </label>
              <input type="password" className="input" placeholder="Min 8 characters" />
            </div>
            <button type="submit" className="btn-primary w-full px-4 py-2 text-sm">
              Create account
            </button>
          </form>

          <div className="mt-6 space-y-2 text-sm text-slate-500">
            <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> No credit card required</div>
            <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> 3 bids free, no time limit</div>
            <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Cancel anytime</div>
          </div>

          <div className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/auth/login" className="font-medium text-amber-600 hover:text-amber-700">
              Log in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
