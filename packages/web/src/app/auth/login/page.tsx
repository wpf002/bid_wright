"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileSignature, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in? Don't show the form again.
  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      toast.success("Welcome back");
      router.push("/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
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
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Welcome back</h1>
          <p className="mt-1 text-sm text-slate-500">Log in to your bid board.</p>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Email
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
                autoComplete="current-password"
                className="input"
                placeholder="••••••••"
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
              {submitting ? "Logging In…" : "Log In"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500">
            No account?{" "}
            <Link href="/auth/register" className="font-medium text-amber-600 hover:text-amber-700">
              Start Free Trial
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
