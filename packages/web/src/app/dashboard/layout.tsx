import Link from "next/link";
import { HardHat, LayoutDashboard, FileText, Calendar, BarChart3, Settings, LogOut, Plus } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sidebar */}
      <aside className="hidden w-60 flex-col border-r border-slate-200 bg-white lg:flex dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 px-6 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500 text-slate-950">
            <HardHat className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">BidWright</span>
        </div>

        <div className="px-3">
          <Link href="/bids/new" className="btn-primary w-full px-3 py-2 text-sm">
            <Plus className="h-4 w-4" />
            New bid
          </Link>
        </div>

        <nav className="mt-6 flex-1 space-y-1 px-3 text-sm">
          <NavItem href="/dashboard" icon={LayoutDashboard}>Bid Board</NavItem>
          <NavItem href="/bids" icon={FileText}>All Bids</NavItem>
          <NavItem href="/dashboard/calendar" icon={Calendar}>Calendar</NavItem>
          <NavItem href="/dashboard/analytics" icon={BarChart3}>Analytics</NavItem>
          <div className="my-3 border-t border-slate-200 dark:border-slate-800" />
          <NavItem href="/dashboard/settings" icon={Settings}>Settings</NavItem>
        </nav>

        <div className="border-t border-slate-200 p-3 dark:border-slate-800">
          <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}

function NavItem({
  href, icon: Icon, children,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      <Icon className="h-4 w-4" />
      {children}
    </Link>
  );
}
