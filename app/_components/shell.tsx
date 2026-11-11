import Link from "next/link";
import type { ReactNode } from "react";
import { AI_MODE_COPY, type ConsoleChrome } from "@/lib/server/console";
import { ThemeToggle } from "./client";
import { Icon, Orb, type IconName } from "./ui";

type Section = "calls" | "approvals" | "settings" | "system";

const NAV: Array<{ id: Section; href: string; label: string; short: string; icon: IconName }> = [
  { id: "calls", href: "/dashboard", label: "Calls", short: "Calls", icon: "inbox" },
  { id: "approvals", href: "/approvals", label: "Answers to approve", short: "Answers", icon: "approvals" },
  { id: "settings", href: "/settings", label: "Settings", short: "Settings", icon: "settings" },
  { id: "system", href: "/system", label: "System health", short: "Health", icon: "pulse" },
];

export function orbState(mode: ConsoleChrome["mode"]): "live" | "standby" | "off" {
  return mode === "off" ? "off" : mode === "always" ? "live" : "standby";
}

/**
 * The console frame: a sidebar on wide screens; on phones a slim top bar and a bottom tab bar within thumb
 * reach. Calls and approvals carry a count of what's waiting, so the next job is visible from any page.
 */
export function Shell({ active, chrome, children, className }: { active: Section | null; chrome: ConsoleChrome; children: ReactNode; className?: string }) {
  const names = chrome.companies.filter((c) => c.kind === "company").map((c) => c.name);
  const mode = AI_MODE_COPY[chrome.mode];
  const waiting = chrome.companies.reduce((sum, c) => sum + c.waiting, 0);
  const count = (id: Section) => (id === "calls" ? waiting : id === "approvals" ? chrome.approvalsWaiting : 0);
  return (
    <div className={`shell${className ? ` ${className}` : ""}`}>
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
              {count(item.id) > 0 && (
                <span className={`count${item.id === "calls" ? " alert" : ""}`} aria-label={`${count(item.id)} waiting`}>
                  {count(item.id)}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="grow" />
        <Link href="/settings#answering" className="status-mini">
          <Orb state={orbState(chrome.mode)} />
          <b>Assistant</b>
          <span>{mode.short}</span>
        </Link>
        <div className="side-foot">
          <ThemeToggle />
          <span className="meta">Light or dark</span>
        </div>
      </aside>

      <header className="topbar">
        <Link href="/dashboard" className="logo">
          <Orb state={orbState(chrome.mode)} size="sm" />
          <b>Lightline</b>
        </Link>
        <span className="grow" />
        <ThemeToggle />
      </header>

      <main className="main">
        <div className="inner">{children}</div>
      </main>

      <nav className="tabbar" aria-label="Console">
        {NAV.map((item) => (
          <Link key={item.id} href={item.href} aria-current={active === item.id ? "page" : undefined}>
            <Icon name={item.icon} size={20} />
            {item.short}
            {count(item.id) > 0 && <span className="count">{count(item.id)}</span>}
          </Link>
        ))}
      </nav>
    </div>
  );
}
