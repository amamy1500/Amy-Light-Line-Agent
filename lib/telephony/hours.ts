/**
 * Ring window: the local hours during which an inbound call rings the owner
 * before falling back to message capture. Outside the window the caller goes
 * straight to the after-hours recovery greeting.
 */
export interface RingWindow {
  /** IANA zone, e.g. "America/Chicago". */
  timezone: string;
  /** Local start time, "HH:MM" or "HH:MM:SS" (Postgres `time` text). */
  start: string;
  /** Local end time, exclusive. Equal to `start` means "always ring". */
  end: string;
}

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d+)?)?$/;

/** Minutes after local midnight for a clock string. Throws on malformed input. */
export function parseClock(value: string): number {
  const match = CLOCK.exec(value);
  if (!match) {
    throw new Error(`Invalid clock time "${value}" (expected HH:MM)`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Minutes after local midnight for `now` in `timezone`. */
export function localMinutes(now: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  const minute = Number(parts.find((p) => p.type === "minute")?.value);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    throw new Error(`Could not resolve local time in ${timezone}`);
  }
  return hour * 60 + minute;
}

/**
 * True when `now` falls inside the window. Windows may cross midnight
 * (start 20:00, end 02:00). A window whose start equals its end rings 24/7.
 */
export function isWithinRingWindow(now: Date, window: RingWindow): boolean {
  const start = parseClock(window.start);
  const end = parseClock(window.end);
  if (start === end) return true;
  const t = localMinutes(now, window.timezone);
  return start < end ? t >= start && t < end : t >= start || t < end;
}
