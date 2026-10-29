export type DialOutcome = "owner_answered" | "recovery";

/**
 * The single rule for "did the owner take this call?".
 *
 * Twilio reports DialCallStatus=completed both when the owner talked to the
 * caller and when the screening leg hung up (e.g. carrier voicemail answered),
 * so the status string cannot decide this. DialBridged=true is sent only when
 * the owner's leg was actually connected, and our screen only lets the leg
 * connect after a keypress. Anything else — including a missing parameter —
 * routes to recovery, biasing toward capturing the caller.
 *
 * The database function app.resolve_dial applies the same rule; both are
 * tested against the same truth table.
 */
export function decideAfterDial(dialBridged: string | boolean | undefined | null): DialOutcome {
  return dialBridged === true || dialBridged === "true" ? "owner_answered" : "recovery";
}
