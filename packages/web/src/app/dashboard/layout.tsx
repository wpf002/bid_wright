"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileSignature, LayoutDashboard, Columns3, Calendar, BarChart3, Settings, LogOut, Plus,
  Menu, X, Sun, Moon, Command,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { resolved, toggle } = useTheme();
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Mobile top bar — the sidebar is hidden below lg. */}
      <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5 lg:hidden dark:border-slate-800 dark:bg-slate-900">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500 text-slate-950">
            <FileSignature className="h-4 w-4" strokeWidth={2.5} />
          </div>
          <span className="font-semibold text-slate-900 dark:text-slate-100">BidWright</span>
        </Link>
        <button
          onClick={() => setNavOpen((o) => !o)}
          aria-label={navOpen ? "Close menu" : "Open menu"}
          aria-expanded={navOpen}
          className="btn-ghost h-8 w-8 p-0"
        >
          {navOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {navOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={() => setNavOpen(false)}
          role="presentation"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0 dark:border-slate-800 dark:bg-slate-900 ${
          navOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-6 py-5">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500 text-slate-950">
              <FileSignature className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">BidWright</span>
          </Link>
          <button
            onClick={() => setNavOpen(false)}
            aria-label="Close menu"
            className="btn-ghost h-7 w-7 p-0 lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-3">
          <Link href="/bids/new" onClick={() => setNavOpen(false)} className="btn-primary w-full px-3 py-2 text-sm">
            <Plus className="h-4 w-4" />
            New Bid
          </Link>
        </div>

        <nav className="mt-6 flex-1 space-y-1 px-3 text-sm">
          <NavItem href="/dashboard" icon={LayoutDashboard} onNavigate={() => setNavOpen(false)}>Bid Board</NavItem>
          <NavItem href="/dashboard/kanban" icon={Columns3} onNavigate={() => setNavOpen(false)}>Kanban</NavItem>
          <NavItem href="/dashboard/calendar" icon={Calendar} onNavigate={() => setNavOpen(false)}>Calendar</NavItem>
          <NavItem href="/dashboard/analytics" icon={BarChart3} onNavigate={() => setNavOpen(false)}>Analytics</NavItem>
          <div className="my-3 border-t border-slate-200 dark:border-slate-800" />
          <NavItem href="/dashboard/settings" icon={Settings} onNavigate={() => setNavOpen(false)}>Settings</NavItem>
        </nav>

        <div className="space-y-1 border-t border-slate-200 p-3 dark:border-slate-800">
          <div className="hidden items-center gap-1.5 px-3 pb-1 text-[11px] text-slate-400 lg:flex">
            <Command className="h-3 w-3" />
            <span>K to search</span>
          </div>
          <button
            onClick={toggle}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            {resolved === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {resolved === "dark" ? "Light Mode" : "Dark Mode"}
          </button>
          {user && (
            <div className="truncate px-3 pt-1 text-xs text-slate-500" title={user.email}>
              {user.companyName ?? user.email}
            </div>
          )}
          <button
            onClick={() => void logout()}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <LogOut className="h-4 w-4" />
            Log Out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-x-hidden pt-12 lg:pt-0">{children}</main>
    </div>
  );
}

function NavItem({
  href, icon: Icon, children, onNavigate,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2.5 rounded-md px-3 py-2 ${
        active
          ? "bg-slate-100 font-medium text-slate-900 dark:bg-slate-800 dark:text-slate-100"
          : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      }`}
    >
      <Icon className="h-4 w-4" />
      {children}
    </Link>
  );
}
