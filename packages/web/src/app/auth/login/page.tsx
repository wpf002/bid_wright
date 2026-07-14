import Link from "next/link";
import { HardHat } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500 text-slate-950">
            <HardHat className="h-5 w-5" strokeWidth={2.5} />
          </div>
          BidWright
        </Link>

        <div className="card p-8">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Welcome back</h1>
          <p className="mt-1 text-sm text-slate-500">Log in to your bid board.</p>

          <form className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Email
              </label>
              <input type="email" className="input" placeholder="you@company.com" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Password
              </label>
              <input type="password" className="input" placeholder="••••••••" />
            </div>
            <button type="submit" className="btn-primary w-full px-4 py-2 text-sm">
              Log in
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500">
            No account?{" "}
            <Link href="/auth/register" className="font-medium text-amber-600 hover:text-amber-700">
              Start free trial
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
