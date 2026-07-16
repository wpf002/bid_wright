"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Library, Plus, Check, Trash2, BookmarkPlus, Loader2 } from "lucide-react";
import { api, type ClauseKind, type UserClause } from "@/lib/api";

/**
 * The user's own reusable clauses for one kind, with one-click insert.
 *
 * Phase 2 seeds generic per-trade clauses into the draft; this is the firm's
 * own wording, which accumulates as they save the lines they actually use.
 */
export function ClauseLibrary({
  kind,
  trade,
  current,
  onInsert,
}: {
  kind: ClauseKind;
  trade: string | null;
  /** Clauses already on the bid — used to disable duplicate inserts. */
  current: string[];
  onInsert: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [clauses, setClauses] = useState<UserClause[] | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setClauses(await api.listClauses(kind));
    } catch {
      setClauses([]);
    }
  }, [kind]);

  useEffect(() => {
    if (open && clauses === null) void load();
  }, [open, clauses, load]);

  const relevant = (clauses ?? []).filter((c) => c.trade === null || c.trade === trade);

  async function insert(clause: UserClause) {
    onInsert(clause.text);
    // Fire-and-forget: the count is a nicety, not worth blocking the insert.
    api.markClauseUsed(clause.id).catch(() => undefined);
  }

  async function saveAll() {
    const unsaved = current.filter((t) => !(clauses ?? []).some((c) => c.text === t));
    if (unsaved.length === 0) {
      toast.info("Every clause on this bid is already in your library");
      return;
    }
    setSaving(true);
    try {
      for (const text of unsaved) {
        await api.createClause({ kind, trade, text });
      }
      await load();
      toast.success(`Saved ${unsaved.length} to your library`);
    } catch {
      toast.error("Could not save to your library");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setClauses((prev) => (prev ?? []).filter((c) => c.id !== id));
    try {
      await api.deleteClause(id);
    } catch {
      toast.error("Could not remove");
      void load();
    }
  }

  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="btn-secondary px-2.5 py-1 text-xs">
          <Library className="h-3.5 w-3.5" />
          Your library
          {relevant.length > 0 && <span className="font-mono text-slate-400">{relevant.length}</span>}
        </button>
        {current.length > 0 && (
          <button onClick={() => void saveAll()} disabled={saving} className="btn-ghost px-2.5 py-1 text-xs">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookmarkPlus className="h-3.5 w-3.5" />}
            Save these to library
          </button>
        )}
      </div>

      {open && (
        <div className="card mt-2 max-h-64 overflow-y-auto p-1.5">
          {clauses === null && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            </div>
          )}
          {clauses !== null && relevant.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-slate-500">
              Nothing saved yet. Use “Save these to library” to reuse this bid’s wording next time.
            </p>
          )}
          <ul className="space-y-0.5">
            {relevant.map((c) => {
              const already = current.includes(c.text);
              return (
                <li key={c.id} className="group flex items-start gap-1.5 rounded-md px-1.5 py-1 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <button
                    onClick={() => void insert(c)}
                    disabled={already}
                    title={already ? "Already on this bid" : "Insert"}
                    className="mt-0.5 shrink-0 rounded p-0.5 text-slate-400 hover:text-amber-600 disabled:opacity-40"
                  >
                    {already ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Plus className="h-3.5 w-3.5" />}
                  </button>
                  <span className="flex-1 text-xs text-slate-700 dark:text-slate-300">{c.text}</span>
                  {c.useCount > 0 && (
                    <span className="shrink-0 font-mono text-[10px] text-slate-400" title={`Used ${c.useCount} times`}>
                      {c.useCount}×
                    </span>
                  )}
                  <button
                    onClick={() => void remove(c.id)}
                    aria-label="Remove from library"
                    className="shrink-0 rounded p-0.5 text-slate-300 opacity-0 hover:text-red-600 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
