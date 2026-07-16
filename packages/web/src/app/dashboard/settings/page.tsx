"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Inbox, Copy, Check, RefreshCw, Loader2, AlertTriangle, Mail, FileText, X,
} from "lucide-react";
import { api, type InboxAddress, type InboundMessage } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import { relativeTime } from "@/lib/bid-board";

export default function SettingsPage() {
  const { user } = useRequireAuth();
  const [inbox, setInbox] = useState<InboxAddress | null>(null);
  const [messages, setMessages] = useState<InboundMessage[]>([]);
  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);

  const load = useCallback(async () => {
    const [addr, msgs] = await Promise.all([
      api.inboxAddress().catch(() => null),
      api.inboxMessages().catch(() => []),
    ]);
    setInbox(addr);
    setMessages(msgs);
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  async function copy() {
    if (!inbox) return;
    await navigator.clipboard.writeText(inbox.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function rotate() {
    if (!confirm("Rotate your address? The current one stops working immediately.")) return;
    setRotating(true);
    try {
      const next = await api.rotateInboxAddress();
      setInbox((prev) => (prev ? { ...prev, address: next.address } : prev));
      toast.success("New address generated");
    } catch {
      toast.error("Could not rotate the address");
    } finally {
      setRotating(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Settings</h1>
      <p className="mt-1 text-sm text-slate-500">
        {user?.companyName ?? user?.email}
      </p>

      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <Inbox className="h-4 w-4" />
          Bids by email
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Forward an ITB to your private address and it lands on your bid board, read and drafted.
          Set one auto-forward rule and it happens without you.
        </p>

        {!inbox ? (
          <div className="card mt-3 flex justify-center p-6">
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          </div>
        ) : (
          <>
            <div className="card mt-3 flex flex-wrap items-center gap-2 p-3">
              <code className="flex-1 truncate rounded bg-slate-50 px-2 py-1.5 font-mono text-sm text-slate-900 dark:bg-slate-950 dark:text-slate-100">
                {inbox.address}
              </code>
              <button onClick={() => void copy()} className="btn-secondary px-2.5 py-1.5 text-xs">
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button onClick={() => void rotate()} disabled={rotating} className="btn-ghost px-2.5 py-1.5 text-xs">
                {rotating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Rotate
              </button>
            </div>

            {!inbox.configured && (
              <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  This address isn’t receiving mail yet — the inbound domain still needs to be
                  connected. Your address is reserved and will work as soon as it is.
                </span>
              </div>
            )}

            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200">
                How to auto-forward ITBs from Gmail
              </summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-slate-500">
                <li>Gmail → Settings → Forwarding → “Add a forwarding address”, paste the address above, and confirm it.</li>
                <li>Settings → Filters → “Create a new filter”.</li>
                <li>
                  In <em>Has the words</em>, try:{" "}
                  <code className="rounded bg-slate-100 px-1 font-mono dark:bg-slate-800">
                    (&quot;invitation to bid&quot; OR ITB OR &quot;request for quote&quot;) has:attachment
                  </code>
                </li>
                <li>Choose “Forward it to” and pick your BidWright address.</li>
              </ol>
              <p className="mt-2 text-xs text-slate-400">
                You can also just forward anything by hand — BidWright ignores what isn’t a
                solicitation.
              </p>
            </details>
          </>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Recent inbound mail</h2>
        <p className="mt-1 text-sm text-slate-500">
          Everything that reached your address, and what BidWright decided.
        </p>

        {messages.length === 0 ? (
          <div className="card mt-3 px-4 py-10 text-center text-sm text-slate-500">
            Nothing yet. Forward an ITB to the address above to try it.
          </div>
        ) : (
          <ul className="card mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {messages.map((m) => (
              <li key={m.id} className="flex items-start gap-3 p-3">
                <ClassificationIcon classification={m.classification} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {m.bidId ? (
                      <Link
                        href={`/bids/${m.bidId}`}
                        className="truncate text-sm font-medium text-slate-900 hover:text-amber-600 dark:text-slate-100"
                      >
                        {m.subject || "(no subject)"}
                      </Link>
                    ) : (
                      <span className="truncate text-sm text-slate-700 dark:text-slate-300">
                        {m.subject || "(no subject)"}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-slate-500">{m.fromAddress}</p>
                  {/* Say why, so a miss is debuggable rather than mysterious. */}
                  <p className="mt-0.5 text-xs text-slate-400">
                    {m.error ? `Failed: ${m.error}` : m.reasons?.join(" · ")}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-slate-400">{relativeTime(m.receivedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ClassificationIcon({ classification }: { classification: InboundMessage["classification"] }) {
  if (classification === "itb") {
    return (
      <span title="Detected as an ITB" className="mt-0.5 shrink-0 text-emerald-600">
        <FileText className="h-4 w-4" />
      </span>
    );
  }
  if (classification === "uncertain") {
    return (
      <span title="Borderline — checked by the classifier" className="mt-0.5 shrink-0 text-amber-500">
        <Mail className="h-4 w-4" />
      </span>
    );
  }
  return (
    <span title="Not a solicitation" className="mt-0.5 shrink-0 text-slate-300">
      <X className="h-4 w-4" />
    </span>
  );
}
