/**
 * Lines the assistant says word for word, shared by the prompt, the tools and
 * the evals so all three always agree.
 */

/** The first thing said about danger, before any tool runs (docs/research/voice-agent-edge-cases.md C1). */
export const SAFETY_LINE = "If anyone is hurt, or anything is sparking or burning, please hang up and call 911 now.";

/**
 * The Spanish greeting, used once a native speaker has checked these words
 * (Settings → Safety & languages). The disclosures are the same three as in
 * English (docs/research/legal-compliance.md §2.2).
 */
export const SPANISH_OPENING =
  "Gracias por llamar. Soy un asistente de inteligencia artificial, no una persona. Esta llamada se graba y se transcribe. ¿En qué le puedo ayudar?";

/** "our team" → "Our team": a name or team that starts a sentence. */
function sentenceStart(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * When nothing approved answers a question (Amy, 2026-10-29): don't guess, and
 * make sure the person calling back sees it. `name` is who calls back.
 */
export function dontGuessLine(name: string): string {
  return `I don't want to give you the wrong information on that. I'll make sure ${name} sees the question before the callback.`;
}

/**
 * The question Amy asks about every property (2026-10-29), naming the front
 * and the roofline since that is what Josh looks at (after the first live call).
 */
export const MAPS_QUESTION = "Is the front of your home and the roofline pretty easy to see on Google Maps, or is it mostly hidden by trees?";

/**
 * A home that's hard to see on Google Maps needs a visit, which the team sets
 * up on the callback (Amy, 2026-10-29). The assistant never picks the day.
 */
export function mapsHiddenLine(name: string): string {
  return `Thanks for letting me know. Since it's hard to see on Google Maps, ${name} will call you to set up a time to come take a look.`;
}

/** The caller isn't sure whether the home shows on Google Maps (Amy, 2026-10-29). */
export function mapsUnsureLine(name: string): string {
  return `No problem. ${sentenceStart(name)} will check, and if it's hard to see, they'll call to set up a time to come take a look.`;
}

/**
 * The callback question (Amy, 2026-10-29). With call hours it says them first,
 * so the caller picks a time that works for both. `name` is who calls back.
 */
export function callbackQuestion(name: string, hours: string | null = null): string {
  return hours
    ? `${sentenceStart(name)} returns calls ${hours}. When would be the best time to give you a call?`
    : `When would be the best time for ${name} to give you a call?`;
}

/** Said once when the caller picks a weekend or an evening (Amy, 2026-10-29). */
export function outsideHoursLine(name: string, hours: string, choice: string): string {
  return `I'm sorry, ${name} only makes calls ${hours}. Would ${choice} work for you?`;
}
