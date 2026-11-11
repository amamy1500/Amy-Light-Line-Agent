/**
 * Short labels for the calls inbox: when a call came in ("12 min ago", "Yesterday 4:20 PM"), which day group it
 * sits under, the city out of an address, and a caller's initials. Pure functions of their inputs, so the list
 * reads the same on every refresh and in tests.
 */

function dayKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function daysBetween(date: Date, now: Date, timeZone: string): number {
  const a = Date.parse(dayKey(date, timeZone));
  const b = Date.parse(dayKey(now, timeZone));
  return Math.round((b - a) / 86_400_000);
}

const time = (date: Date, timeZone: string) => new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(date);

/** "just now", "12 min ago", "3 h ago", "Yesterday 4:20 PM", "Mon 11:58 AM", "Nov 4". */
export function relativeWhen(date: Date, now: Date, timeZone: string): string {
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const days = daysBetween(date, now, timeZone);
  if (days === 0) return `${Math.floor(minutes / 60)} h ago`;
  if (days === 1) return `Yesterday ${time(date, timeZone)}`;
  if (days < 7) return `${new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date)} ${time(date, timeZone)}`;
  return new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric" }).format(date);
}

/** The heading a call sits under when the list is sorted by time: "Today", "Yesterday", "Monday, Nov 9", "Oct 30". */
export function dayLabel(date: Date, now: Date, timeZone: string): string {
  const days = daysBetween(date, now, timeZone);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long", month: "short", day: "numeric" }).format(date);
  return new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric", ...(days > 300 ? { year: "numeric" } : {}) }).format(date);
}

const STATE_OR_ZIP = /^(texas|tx)?\s*(\d{5}(-\d{4})?)?$/i;

/** "444 Shoal Creek Boulevard, Austin, Texas 78759" → "Austin"; "1406 Prairie Rose Ln, Round Rock" → "Round Rock". */
export function cityOf(address: string | null): string | null {
  if (!address) return null;
  const parts = address.split(",").map((p) => p.trim()).filter((p) => p && !STATE_OR_ZIP.test(p));
  if (parts.length < 2) return null;
  return parts.at(-1)!.replace(/\s+\d{5}(-\d{4})?$/, "") || null;
}

/** "Sam Patel" → "SP"; a number or nothing → "#". */
export function initials(name: string | null): string {
  const words = (name ?? "").split(/\s+/).map((w) => w.replace(/[^\p{L}]/gu, "")).filter(Boolean);
  if (!words.length) return "#";
  return (words[0]![0]! + (words.length > 1 ? words.at(-1)![0]! : "")).toUpperCase();
}
