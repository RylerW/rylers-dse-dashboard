import Link from "next/link";
import { ReactNode } from "react";

import { APP_NAME } from "@/lib/branding";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <Link href="/" className="brand">{APP_NAME}</Link>
          <p className="tagline">Daily movers, watchlists, alerts, and data health in one place.</p>
        </div>
        <nav className="nav">
          <Link href="/">Dashboard</Link>
          <Link href="/watchlist">Watchlist</Link>
          <Link href="/alerts">Alerts</Link>
          <Link href="/admin">Admin</Link>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
