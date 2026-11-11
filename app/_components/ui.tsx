import type { ReactNode } from "react";

/**
 * The console's small building blocks, in the 21st.dev agent-UI language but
 * with no component library (docs/research/ui-21st-dev.md, option b). All
 * server-rendered: forms post, nothing needs JavaScript to work.
 */

/** Stroke icons drawn for Lightline on a 24-unit grid. */
const ICONS = {
  calls: "M4 13h4l1.5 2.5h5L16 13h4M5.2 5h13.6l1.2 8v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5z",
  approvals: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8.5 12.5l2.5 2.5 4.5-5",
  settings: "M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4",
  phone: "M5 4h3l2 5-2.5 1.5a11 11 0 0 0 5 5L14 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z",
  shield: "M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6zM9 12l2 2 4-4",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
  bell: "M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0",
  building: "M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M3 21h18M8 8h3M8 12h3M8 16h3",
  history: "M3 12a9 9 0 1 0 3-6.7M3 4v4h4M12 8v4l3 2",
  lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  back: "M15 6l-6 6 6 6",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  ban: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM5.6 5.6l12.8 12.8",
  key: "M14.5 9.5a4 4 0 1 0-1.3 3L20 19.3M17 16.3l2-2",
  message: "M4 5h16v11H9l-5 4z",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z",
  check: "M5 12.5l4.5 4.5L19 7.5",
  outgoing: "M5 4h3l2 5-2.5 1.5a11 11 0 0 0 5 5L14 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2zM15 3h6v6M21 3l-6 6",
  pulse: "M3 12h4l2.5-6 5 12 2.5-6h4",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4.2-4.2",
  pin: "M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10zM12 8.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
  chevron: "M9 6l6 6-6 6",
  external: "M14 4h6v6M20 4l-8 8M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  moon: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z",
  copy: "M9 9h10v11H9zM5 15H4V4h11v1",
  flame: "M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 1.5 1 2.5 2.5 3-.5-3 0-5.5 0-8z",
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
  inbox: "M4 13h4l1.5 2.5h5L16 13h4M5.2 5h13.6l1.2 8v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5z",
} as const;
export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 18, label }: { name: IconName; size?: number; label?: string }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

/** The assistant's presence: spinning while it answers calls, slow on standby, grey when off. */
export function Orb({ state, size }: { state: "live" | "standby" | "off"; size?: "sm" | "lg" }) {
  return <span className={`orb${size ? ` ${size}` : ""}`} data-state={state} aria-hidden="true" />;
}

/** A real checkbox (posts "on"), drawn as a switch. */
export function Switch({ name, defaultChecked, label, hint }: { name: string; defaultChecked: boolean; label: string; hint?: string }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" name={name} defaultChecked={defaultChecked} />
      <span className="track" aria-hidden="true" />
      <span className="text">
        <b>{label}</b>
        {hint && <span>{hint}</span>}
      </span>
    </label>
  );
}

export function StatTile({ value, label, tone }: { value: number; label: string; tone?: "hot" }) {
  return (
    <div className={`stat${tone && value > 0 ? ` ${tone}` : ""}${value === 0 ? " zero" : ""}`}>
      <b className="num">{value}</b>
      <span>{label}</span>
    </div>
  );
}

/** A titled card with an icon: one topic of a page (Settings, System health). */
export function Section(props: { id: string; icon: IconName; title: string; lead: string; scope?: string; children: ReactNode }) {
  return (
    <section id={props.id} className="panel-card section-card" aria-labelledby={`h-${props.id}`}>
      <header>
        <span className="ic">
          <Icon name={props.icon} />
        </span>
        <div>
          <h3 id={`h-${props.id}`}>{props.title}</h3>
          <p>{props.lead}</p>
        </div>
        {props.scope && <span className="scope">{props.scope}</span>}
      </header>
      {props.children}
    </section>
  );
}

export function Notice({ tone, children }: { tone: "ok" | "bad"; children: ReactNode }) {
  return (
    <p className={`notice${tone === "ok" ? " ok" : ""}`} role={tone === "bad" ? "alert" : "status"}>
      <Icon name={tone === "ok" ? "check" : "shield"} size={16} />
      <span>{children}</span>
    </p>
  );
}
