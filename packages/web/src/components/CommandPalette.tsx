"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search, FileText, Plus, LayoutDashboard, Calendar, Columns3, BarChart3,
  Settings, Sun, Moon, LogOut,
} from "lucide-react";
import { api, type BidRow } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
import { fuzzyMatch } from "@/lib/command";

export interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  run: () => void;
  group: string;
}

export function CommandPalette() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { toggle, resolved } = useTheme();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [bids, setBids] = useState<BidRow[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Cmd+K / Ctrl+K anywhere, plus a custom event so a touch device (which has
  // no keyboard) can open it from an on-screen button.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-palette", onOpen);
    };
  }, []);

  // Load bids lazily, only once the palette is first opened.
  useEffect(() => {
    if (!open || !user || bids.length) return;
    api.listBids().then(setBids).catch(() => undefined);
  }, [open, user, bids.length]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      // Focus after paint so the input exists.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  const commands: Command[] = useMemo(() => {
    const go = (href: string) => () => {
      router.push(href);
      close();
    };
    const nav: Command[] = [
      { id: "new", label: "New bid", hint: "Upload an ITB", icon: Plus, run: go("/bids/new"), group: "Actions" },
      { id: "board", label: "Bid Board", icon: LayoutDashboard, run: go("/dashboard"), group: "Go to" },
      { id: "kanban", label: "Kanban", icon: Columns3, run: go("/dashboard/kanban"), group: "Go to" },
      { id: "calendar", label: "Calendar", icon: Calendar, run: go("/dashboard/calendar"), group: "Go to" },
      { id: "analytics", label: "Analytics", icon: BarChart3, run: go("/dashboard/analytics"), group: "Go to" },
      { id: "settings", label: "Settings", icon: Settings, run: go("/dashboard/settings"), group: "Go to" },
      {
        id: "theme",
        label: resolved === "dark" ? "Switch to light mode" : "Switch to dark mode",
        icon: resolved === "dark" ? Sun : Moon,
        run: () => {
          toggle();
          close();
        },
        group: "Actions",
      },
      {
        id: "logout",
        label: "Log out",
        icon: LogOut,
        run: () => {
          void logout();
          close();
        },
        group: "Actions",
      },
    ];

    const bidCommands: Command[] = bids.map((b) => ({
      id: `bid-${b.id}`,
      label: b.projectName ?? b.itbFileName,
      hint: b.gcName ?? undefined,
      icon: FileText,
      run: go(`/bids/${b.id}`),
      group: "Bids",
    }));

    return [...nav, ...bidCommands];
  }, [bids, router, close, toggle, resolved, logout]);

  const results = useMemo(
    () => commands.filter((c) => fuzzyMatch(`${c.label} ${c.hint ?? ""}`, query)),
    [commands, query],
  );

  // Keep the selection in range as results shrink.
  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, results.length - 1)));
  }, [results.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => (a + 1) % Math.max(1, results.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => (a - 1 + results.length) % Math.max(1, results.length));
      } else if (e.key === "Enter") {
        e.preventDefault();
        results[active]?.run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, active, close]);

  // Keep the active row visible while arrowing.
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open || !user) return null;

  let lastGroup = "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-4 pt-[12vh] backdrop-blur-sm"
      onClick={close}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-center gap-2 border-b border-slate-200 px-3 dark:border-slate-800">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search bids or jump to…"
            aria-label="Search commands"
            className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-slate-400 dark:text-slate-100"
          />
          <kbd className="hidden shrink-0 rounded border border-slate-200 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 sm:block dark:border-slate-700">
            esc
          </kbd>
        </div>

        <ul ref={listRef} className="max-h-80 overflow-y-auto p-1.5">
          {results.length === 0 && (
            <li className="px-3 py-8 text-center text-sm text-slate-500">No matches</li>
          )}
          {results.map((c, i) => {
            const header = c.group !== lastGroup ? c.group : null;
            lastGroup = c.group;
            const Icon = c.icon;
            return (
              <li key={c.id}>
                {header && (
                  <div className="px-2 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                    {header}
                  </div>
                )}
                <button
                  data-index={i}
                  onMouseEnter={() => setActive(i)}
                  onClick={c.run}
                  aria-selected={i === active}
                  className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm ${
                    i === active
                      ? "bg-amber-50 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                      : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="flex-1 truncate">{c.label}</span>
                  {c.hint && <span className="truncate text-xs text-slate-400">{c.hint}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
