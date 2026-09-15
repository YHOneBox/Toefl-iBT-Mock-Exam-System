"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { appPath } from "@/lib/base-path";
import { ActivityLogControl } from "./activity-log-control";

export function AppShell({
  children,
  nav,
  brandHref = "/",
}: {
  children: ReactNode;
  nav?: ReactNode;
  brandHref?: string;
}) {
  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="app-brand-row">
          <Link href={brandHref} className="app-brand">
            <img
              src={`${appPath("/logo.png")}?v=2`}
              alt="TOEFL iBT Mock Exam System"
              className="app-brand-logo"
              width={44}
              height={44}
            />
            <span className="app-brand-copy">
              <strong>Practice studio</strong>
              <small>Enhanced TOEFL mock</small>
            </span>
          </Link>
          <ActivityLogControl />
        </div>
        <div className="app-topbar-nav">{nav}</div>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
