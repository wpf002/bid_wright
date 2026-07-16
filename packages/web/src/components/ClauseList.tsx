"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

/** Editable list of free-text clauses (assumptions / clarifications / exclusions). */
export function ClauseList({
  items,
  onChange,
  addLabel,
  emptyHint,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  addLabel: string;
  emptyHint: string;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const text = draft.trim();
    if (!text) return;
    onChange([...items, text]);
    setDraft("");
  }

  return (
    <div className="space-y-3">
      {items.length === 0 && <p className="text-sm text-slate-500">{emptyHint}</p>}

      <ul className="space-y-2">
        {items.map((text, i) => (
          <li key={i} className="group flex items-start gap-2">
            <textarea
              value={text}
              rows={Math.max(1, Math.ceil(text.length / 90))}
              onChange={(e) => {
                const next = [...items];
                next[i] = e.target.value;
                onChange(next);
              }}
              className="input min-h-0 flex-1 resize-y py-1.5 text-sm"
            />
            <button
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              aria-label="Remove"
              className="mt-1.5 rounded-md p-1 text-slate-300 opacity-0 transition-opacity hover:bg-slate-100 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>

      <div className="flex items-start gap-2">
        <textarea
          value={draft}
          rows={2}
          placeholder={addLabel}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter adds; Shift+Enter makes a newline.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              add();
            }
          }}
          className="input flex-1 resize-y py-1.5 text-sm"
        />
        <button onClick={add} disabled={!draft.trim()} className="btn-secondary mt-0.5 px-2.5 py-2">
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
