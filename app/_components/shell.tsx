import Link from "next/link";
import type { ReactNode } from "react";
import { AI_MODE_COPY, type ConsoleChrome } from "@/lib/server/console";
import { Icon, Orb, type IconName } from "./ui";

type Section = "calls" | "approvals" | "settings" | "system";

const NAV: Array<{ id: Section; href: string; label: string; icon: IconName }> = [
  { id: "calls", href: "/dashboard", label: "Calls", icon: "calls" },
  { id: "approvals", href: "/approvals", label: "Answers to approve", icon: "approvals" },
  { id: "settings", href: "/settings", label: "Settings", icon: "settings" },
  { id: "system", href: "/system", label: "System health", icon: "pulse" },
];

export function orbState(mode: ConsoleChrome["mode"]): "live" | "standby" | "off" {
  return mode === "off" ? "off" : mode === "always" ? "live" : "standby";
}

/** The console frame: sidebar on wide screens, a top bar on phones. */
export function Shell({ active, chrome, children }: { active: Section | null; chrome: ConsoleChrome; children: ReactNode }) {
  const names = chrome.companies.filter((c) => c.kind === "company").map((c) => c.name);
  const mode = AI_MODE_COPY[chrome.mode];
  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/dashboard" className="logo">
          <Orb state={orbState(chrome.mode)} size="sm" />
          <span>
            <b>Lightline</b>
            <small>{names.join(" · ")}</small>
          </span>
        </Link>
        <nav className="nav" aria-label="Console">
          {NAV.map((item) => (
            <Link key={item.id} href={item.href} aria-current={active === item.id ? "page" : undefined}>
              <Icon name={item.icon} />
              <span className="label">{item.label}</span>
              {item.id === "approvals" && chrome.approvalsWaiting > 0 && (
                <span className="count" aria-label={`${chrome.approvalsWaiting} waiting`}>
                  {chrome.approvalsWaiting}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="grow" />
        <Link href="/settings#answering" className="status-mini" style={{ textDecoration: "none", color: "inherit" }}>
          <Orb state={orbState(chrome.mode)} />
          <b>Assistant</b>
          <span>{mode.short}</span>
        </Link>
      </aside>
      <main className="main">
        <div className="inner">{children}</div>
      </main>
    </div>
  );
}
