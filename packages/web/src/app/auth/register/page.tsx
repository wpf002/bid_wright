"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileSignature, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export default function RegisterPage() {
  const { register, user, loading } = useAuth();
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await register({ email, password, companyName: companyName || undefined });
      toast.success("Account created");
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-8 flex items-center justify-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500 text-slate-950">
            <FileSignature className="h-5 w-5" strokeWidth={2.5} />
          </div>
          BidWright
        </Link>

        <div className="card p-8">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Start Free Trial</h1>
          <p className="mt-1 text-sm text-slate-500">3 bids free. No credit card required.</p>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <label htmlFor="company" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Company name
              </label>
              <input
                id="company"
                className="input"
                placeholder="Foti Electric"
                autoComplete="organization"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Work email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                className="input"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="input"
                placeholder="Min 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
                {error}
              </p>
            )}

            <button type="submit" disabled={submitting} className="btn-primary w-full px-4 py-2 text-sm">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Creating Account…" : "Create Account"}
            </button>
          </form>

          <div className="mt-6 space-y-2 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> No credit card required
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> 3 bids free, no time limit
            </div>
          </div>

          <div className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/auth/login" className="font-medium text-amber-600 hover:text-amber-700">
              Log In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
