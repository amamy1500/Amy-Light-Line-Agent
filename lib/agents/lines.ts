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

/**
 * When nothing approved answers a question (Amy, 2026-10-29): don't guess, and
 * make sure the person calling back sees it. `name` is who calls back.
 */
export function dontGuessLine(name: string): string {
  return `I don't want to give you the wrong information on that. I'll make sure ${name} sees the question before the callback.`;
}

/** The question Amy asks about every property (2026-10-29). */
export const MAPS_QUESTION = "Is your home pretty easy to see on Google Maps, or is it hidden by trees?";

/** The callback question, in Amy's words (2026-10-29). `name` is who calls back. */
export function callbackQuestion(name: string): string {
  return `What's the best time for ${name} to call you back?`;
}
