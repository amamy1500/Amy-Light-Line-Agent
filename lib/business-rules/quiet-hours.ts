import { localMinutes } from "@/lib/telephony/hours";

/**
 * When Amy may return a call: Mon–Sat 9 AM–8 PM, Sun noon–8 PM, in the
 * caller's local time — the strictest mix of Texas, Florida, Maryland and
 * Washington rules (docs/research/legal-compliance.md §2.1, §6.1). The
 * caller's zone is unknown from a phone number alone, so the business's
 * zone is used; counsel to confirm.
 */
export interface CallWindow {
  ok: boolean;
  /** Human text, e.g. "OK to call until 8 PM" or "Calls open at 9 AM". */
  label: string;
}

export function callbackWindow(now: Date, timezone = "America/Chicago"): CallWindow {
  const day = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(now);
  const minute = localMinutes(now, timezone);
  const open = day === "Sun" ? 12 * 60 : 9 * 60;
  const close = 20 * 60;
  if (minute >= open && minute < close) return { ok: true, label: "OK to call until 8 PM" };
  if (minute < open) return { ok: false, label: `Calls open at ${day === "Sun" ? "noon" : "9 AM"}` };
  const tomorrowSunday = day === "Sat";
  return { ok: false, label: `Calls open ${tomorrowSunday ? "at noon tomorrow" : "at 9 AM tomorrow"}` };
}
