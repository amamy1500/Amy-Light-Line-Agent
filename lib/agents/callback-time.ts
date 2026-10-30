import { callbackName, type BusinessConfig } from "@/lib/business-rules/config";
import { localDate } from "@/lib/business-rules/routing";
import { localMinutes, parseClock } from "@/lib/telephony/hours";
import { callbackQuestion } from "./lines";

/**
 * When the team calls leads back, in a caller's words: "on weekdays, between
 * nine and five". Amy, 2026-10-29: calls go out on weekdays, nine to five, so
 * the assistant asks for a time inside those hours and steers a caller who
 * picks a weekend or an evening to the next ones ("Would Monday morning or
 * afternoon work for you?"). Pure functions of the config and the clock.
 */

type Hours = NonNullable<BusinessConfig["callbackHours"]>;

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const HOUR_WORDS = ["twelve", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven"];
const MINUTE_WORDS: Record<number, string> = { 15: "fifteen", 30: "thirty", 45: "forty-five" };
const NOON = 12 * 60;
/** A callback offered for later today needs at least this long before the slot ends. */
const SAME_DAY_LEAD_MINUTES = 120;

/** "nine", "five thirty", "noon": a clock time the way people say it, never "9:00". */
export function spokenClock(clock: string): string {
  const total = parseClock(clock);
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  if (total === NOON) return "noon";
  const word = HOUR_WORDS[hour % 12]!;
  if (minute === 0) return word;
  return `${word} ${MINUTE_WORDS[minute] ?? String(minute).padStart(2, "0")}`;
}

/** "on weekdays", "Monday through Saturday", "on Monday and Thursday". */
function spokenDays(days: number[]): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  const key = sorted.join(",");
  if (key === "1,2,3,4,5") return "on weekdays";
  if (key === "0,1,2,3,4,5,6") return "every day";
  if (key === "0,6") return "on weekends";
  const contiguous = sorted.every((d, i) => i === 0 || d === sorted[i - 1]! + 1);
  if (contiguous && sorted.length >= 3) return `${DAY_NAMES[sorted[0]!]} through ${DAY_NAMES[sorted.at(-1)!]}`;
  const names = sorted.map((d) => DAY_NAMES[d]!);
  return `on ${names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0]}`;
}

/** "on weekdays, between nine and five"; days with other hours are named after it. */
export function spokenCallbackHours(hours: Hours): string {
  const groups = new Map<string, number[]>();
  for (const w of hours) groups.set(`${w.open}-${w.close}`, [...(groups.get(`${w.open}-${w.close}`) ?? []), w.day]);
  return [...groups]
    .map(([span, days]) => {
      const [open, close] = span.split("-") as [string, string];
      return `${spokenDays(days)}, between ${spokenClock(open)} and ${spokenClock(close)}`;
    })
    .join(", and ");
}

/** The configured hours, or null when the team calls back whenever the caller likes. */
function hoursOf(config: BusinessConfig): Hours | null {
  return config.callbackHours?.length ? config.callbackHours : null;
}

/** The callback question, word for word, with the team's hours when it has them. */
export function callbackQuestionFor(config: BusinessConfig): string {
  const hours = hoursOf(config);
  return callbackQuestion(callbackName(config), hours ? spokenCallbackHours(hours) : null);
}

/** {{callback_hours}}: what the prompt says the hours are. */
export function callbackHoursNote(config: BusinessConfig): string {
  const hours = hoursOf(config);
  return hours ? spokenCallbackHours(hours) : "whenever suits the caller";
}

/** A YYYY-MM-DD date `days` after another, and its weekday (0 = Sunday). */
function addDays(date: string, days: number): { date: string; weekday: number } {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return { date: d.toISOString().slice(0, 10), weekday: d.getUTCDay() };
}

/**
 * The next two times the team could call, as a choice: "this afternoon or
 * tomorrow morning", "Monday morning or afternoon". Closed days are skipped,
 * and later today is offered only while there's time left to call.
 */
export function callbackChoice(config: BusinessConfig, now: Date): string {
  const hours = hoursOf(config);
  if (!hours) return "tomorrow morning or afternoon";
  const today = localDate(now, config.timezone);
  const minuteNow = localMinutes(now, config.timezone);
  const closed = new Set((config.closures ?? []).map((c) => c.date));
  const slots: Array<{ offset: number; weekday: number; part: string }> = [];
  for (let offset = 0; offset < 14 && slots.length < 2; offset += 1) {
    const day = addDays(today, offset);
    if (closed.has(day.date)) continue;
    for (const w of hours.filter((h) => h.day === day.weekday).sort((a, b) => a.open.localeCompare(b.open))) {
      const open = parseClock(w.open);
      const close = parseClock(w.close) || 24 * 60;
      const parts = [
        { part: "morning", start: open, end: Math.min(close, NOON) },
        { part: open >= 17 * 60 ? "evening" : "afternoon", start: Math.max(open, NOON), end: close },
      ];
      for (const p of parts) {
        if (p.start >= p.end || slots.length >= 2) continue;
        if (offset === 0 && minuteNow + SAME_DAY_LEAD_MINUTES >= p.end) continue;
        slots.push({ offset, weekday: day.weekday, part: p.part });
      }
    }
  }
  const dayWord = (s: { offset: number; weekday: number }) => (s.offset === 0 ? "this" : s.offset === 1 ? "tomorrow" : DAY_NAMES[s.weekday]!);
  const [first, second] = slots;
  if (!first) return "tomorrow morning or afternoon";
  if (!second) return `${dayWord(first)} ${first.part}`;
  if (first.offset === second.offset) {
    return first.offset === 0 ? `this ${first.part} or this ${second.part}` : `${dayWord(first)} ${first.part} or ${second.part}`;
  }
  return `${dayWord(first)} ${first.part} or ${dayWord(second)} ${second.part}`;
}

const DAY_WORDS: Array<[RegExp, number[]]> = [
  [/\bsundays?\b/, [0]],
  [/\bmondays?\b/, [1]],
  [/\btues?days?\b/, [2]],
  [/\bwednesdays?\b/, [3]],
  [/\bthursdays?\b/, [4]],
  [/\bfridays?\b/, [5]],
  [/\bsaturdays?\b/, [6]],
  [/\bweekends?\b/, [0, 6]],
];
const NUMBER = new Map(HOUR_WORDS.map((w, i) => [w, i === 0 ? 12 : i]));
NUMBER.set("noon", 12);
// "after 4", "at four thirty", "around 7 pm", "before nine in the morning", "5 o'clock". A bare number
// ("the 3rd", "in 2 weeks") is never read as a time: it needs a lead word, a colon or am/pm.
const TIME =
  /\b(after|from|at|around|about|by|before|until)?\s*(\d{1,2}|noon|twelve|one|two|three|four|five|six|seven|eight|nine|ten|eleven)(?::(\d{2})|\s+(?:thirty|fifteen|forty-five))?(?!\d|st|nd|rd|th)\s*(o'?clock)?\s*(a\.?m\.?|p\.?m\.?|in the morning|in the afternoon|in the evening|at night|tonight)?/g;

/** Minutes after midnight a spoken hour most likely means, with am/pm when given. */
function minutesOf(hourText: string, meridiem: string | undefined): number | null {
  const hour = /^\d+$/.test(hourText) ? Number(hourText) : NUMBER.get(hourText);
  if (!hour || hour > 12) return null;
  const pm = meridiem ? /^p|afternoon|evening|night|tonight/.test(meridiem) : null;
  if (hour === 12) return pm === false ? 0 : NOON;
  // Without am/pm: one to seven are afternoon or evening calls, eight to eleven are morning ones.
  const isPm = pm ?? (hour >= 1 && hour <= 7);
  return ((hour % 12) + (isPm ? 12 : 0)) * 60;
}

/**
 * True when what the caller said is clearly outside the team's call hours:
 * a day the team doesn't call ("Saturday morning", "this weekend", "tomorrow"
 * on a Friday), an evening ("tonight", "after six"), or a time before opening.
 * Unclear answers ("whenever", "lunchtime") are inside: the caller is never
 * second-guessed on a maybe.
 */
export function outsideCallbackHours(said: string, config: BusinessConfig, now: Date): boolean {
  const hours = hoursOf(config);
  if (!hours) return false;
  const text = said.toLowerCase();
  const days = new Set(hours.map((h) => h.day));
  const today = localDate(now, config.timezone);

  const named = DAY_WORDS.flatMap(([pattern, ds]) => (pattern.test(text) ? ds : []));
  if (/\btomorrow\b/.test(text)) named.push(addDays(today, 1).weekday);
  if (/\b(today|tonight|this (morning|afternoon|evening))\b/.test(text)) named.push(addDays(today, 0).weekday);
  if (named.some((d) => !days.has(d))) return true;

  const opens = Math.min(...hours.map((h) => parseClock(h.open)));
  const closes = Math.max(...hours.map((h) => parseClock(h.close) || 24 * 60));
  if (/\b(tonight|evenings?|nights?)\b/.test(text) && closes <= 17 * 60) return true;
  if (/\b(early (in the )?morning|before work)\b/.test(text) && opens > 8 * 60) return true;

  for (const match of text.matchAll(TIME)) {
    const [, lead, hourText, , , oclock, meridiem] = match;
    if (!lead && !oclock && !meridiem && !match[3]) continue;
    const at = minutesOf(hourText!, meridiem);
    if (at === null) continue;
    if (lead === "after" || lead === "from") {
      if (at >= closes) return true;
    } else if (lead === "before" || lead === "by" || lead === "until") {
      if (at <= opens) return true;
    } else if (at < opens || at >= closes) {
      return true;
    }
  }
  return false;
}
