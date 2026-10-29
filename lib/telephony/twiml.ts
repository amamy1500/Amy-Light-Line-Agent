import twilio from "twilio";

const { VoiceResponse } = twilio.twiml;

/** Everything a call flow needs to know about one tracking line. */
export interface LineConfig {
  /** Spoken brand, e.g. "The Christmas Light Guys". */
  brandName: string;
  /** Who the call rings, e.g. "Amy". */
  ownerName: string;
  /** E.164 number that rings for the owner. */
  ownerPhone: string;
  /** Spoken source in the screening whisper, e.g. "TV". */
  sourceLabel: string;
  ringTimeoutSeconds: number;
  /** Completes "After the tone, …". */
  recoveryAsk: string;
  /**
   * The business number shown on Amy's phone when we ring her, so she knows
   * it's a business call and her phone doesn't silence it as an unknown caller.
   */
  lineNumber?: string;
}

/** Absolute callback URLs. Absolute so Twilio signs exactly what we verify. */
export interface VoiceUrls {
  screen: string;
  screenAccept: string;
  dialResult: string;
  recording: string;
  transcript: string;
  recordDone: string;
  /** Requested when the agent's stream ends (the <Connect> action). */
  agentEnded: string;
  /** Where a live call is redirected to ring Amy after the caller asks for her. */
  handoff: string;
  handoffScreen: string;
  handoffResult: string;
  /** The "press 1 or say yes" gate's answer. */
  screenCaller: string;
}

export function voiceUrls(baseUrl: string): VoiceUrls {
  const at = (path: string) => new URL(`/api/voice/${path}`, baseUrl).toString();
  return {
    screen: at("screen"),
    screenAccept: at("screen-accept"),
    dialResult: at("dial-result"),
    recording: at("recording"),
    transcript: at("transcript"),
    recordDone: at("record-done"),
    agentEnded: at("agent-ended"),
    handoff: at("handoff"),
    handoffScreen: at("screen?stage=handoff"),
    handoffResult: at("handoff-result"),
    screenCaller: at("screen-caller"),
  };
}

/**
 * Amy takes a call by pressing any key: one tap, nothing to remember. Her
 * carrier voicemail presses none, so it can never take a customer.
 */
export function acceptsCall(digits: string | undefined): boolean {
  return typeof digits === "string" && /^[0-9*#]$/.test(digits);
}

/**
 * The keypress screen on Amy's leg. finishOnKey is off so "#" counts as a key
 * instead of ending the gather empty (which would hang up on her).
 */
function screenGather(response: InstanceType<typeof VoiceResponse>, urls: VoiceUrls) {
  return response.gather({
    numDigits: 1,
    finishOnKey: "",
    timeout: 8,
    action: urls.screenAccept,
    method: "POST",
    actionOnEmptyResult: false,
  });
}

/**
 * Agent asked for Amy: ring her with a whisper of the caller's summary. The
 * same any-key screen as the first ring, so her voicemail cannot take it.
 */
export function handoffDialTwiml(line: Pick<LineConfig, "ownerPhone" | "ringTimeoutSeconds" | "lineNumber">, urls: VoiceUrls): string {
  const response = new VoiceResponse();
  const dial = response.dial({
    timeout: line.ringTimeoutSeconds,
    answerOnBridge: true,
    action: urls.handoffResult,
    method: "POST",
    ...(line.lineNumber ? { callerId: line.lineNumber } : {}),
  });
  dial.number({ url: urls.handoffScreen, method: "POST" }, line.ownerPhone);
  return response.toString();
}

/** Amy's leg during a hand-off: who is waiting and why, then any key. */
export function handoffScreenTwiml(brandName: string, note: string | null, urls: VoiceUrls): string {
  const response = new VoiceResponse();
  const gather = screenGather(response, urls);
  const summary = note ? ` ${note.replace(/\s+/g, " ").trim()}.` : "";
  gather.say(`${brandName} caller asking for you.${summary} Press any key to take it.`);
  gather.pause({ length: 1 });
  gather.say("Press any key to take the call.");
  response.hangup();
  return response.toString();
}

/**
 * The agent's stream ended without the agent wrapping up (vendor drop, or a
 * crash). The caller hears a short apology and can leave a message, so the
 * call still ends with something Amy can act on.
 */
export function agentDroppedTwiml(
  line: Pick<LineConfig, "ownerName">,
  urls: VoiceUrls,
  options: { record: boolean },
): string {
  const response = new VoiceResponse();
  if (!options.record) {
    response.say(
      `Sorry about that, I lost the connection on my end. Your details are saved and ${line.ownerName} will call you back. Goodbye.`,
    );
    response.hangup();
    return response.toString();
  }
  response.say(
    `Sorry about that, I lost the connection on my end. Your details are saved and ${line.ownerName} will call you back. ` +
      "If there's anything else, this part is recorded: leave it after the tone.",
  );
  response.record({
    maxLength: 120,
    timeout: 5,
    playBeep: true,
    transcribe: true,
    transcribeCallback: urls.transcript,
    recordingStatusCallback: urls.recording,
    recordingStatusCallbackEvent: ["completed"],
    action: urls.recordDone,
    method: "POST",
  });
  return response.toString();
}

/** Amy missed the hand-off and the agent cannot take the caller back. */
export function handoffMissedTwiml(line: Pick<LineConfig, "ownerName">, urls: VoiceUrls, options: { record: boolean }): string {
  const response = new VoiceResponse();
  const intro = `${line.ownerName} couldn't pick up, but your details are saved and she'll call you back.`;
  if (!options.record) {
    response.say(`${intro} Thanks for calling. Goodbye.`);
    response.hangup();
    return response.toString();
  }
  response.say(`${intro} If you'd like to add anything, this part is recorded: leave it after the tone.`);
  response.record({
    maxLength: 120,
    timeout: 5,
    playBeep: true,
    transcribe: true,
    transcribeCallback: urls.transcript,
    recordingStatusCallback: urls.recording,
    recordingStatusCallbackEvent: ["completed"],
    action: urls.recordDone,
    method: "POST",
  });
  return response.toString();
}

/**
 * Step 1: ring the owner. The screening URL runs on the owner's leg only, so
 * a carrier voicemail that answers never hears a keypress prompt it can pass.
 */
export function ringOwnerTwiml(line: LineConfig, urls: VoiceUrls): string {
  const response = new VoiceResponse();
  const dial = response.dial({
    timeout: line.ringTimeoutSeconds,
    answerOnBridge: true,
    action: urls.dialResult,
    method: "POST",
    ...(line.lineNumber ? { callerId: line.lineNumber } : {}),
  });
  dial.number({ url: urls.screen, method: "POST" }, line.ownerPhone);
  return response.toString();
}

/** Step 2 (owner's leg): whisper the source and require a keypress to bridge. */
export function screenTwiml(line: Pick<LineConfig, "brandName" | "sourceLabel">, urls: VoiceUrls): string {
  const response = new VoiceResponse();
  const gather = screenGather(response, urls);
  // A company's own number has no ad channel to name ("Sublime Patio call.").
  const whisper = line.sourceLabel
    ? `${line.brandName} call from ${line.sourceLabel}. Press any key to take it.`
    : `${line.brandName} call. Press any key to take it.`;
  gather.say(whisper);
  gather.pause({ length: 1 });
  gather.say(whisper);
  // No keypress: hang up the owner's leg so the call is never bridged.
  response.hangup();
  return response.toString();
}

/** Step 3 (owner's leg): any key bridges (an empty response ends the screen); no key hangs up. */
export function screenAcceptTwiml(digits: string | undefined): string {
  const response = new VoiceResponse();
  if (!acceptsCall(digits)) response.hangup();
  return response.toString();
}

/** Recovery: disclosed greeting, then one recorded message with transcription. */
export function recoveryTwiml(line: LineConfig, urls: VoiceUrls, options: { afterHours: boolean }): string {
  const response = new VoiceResponse();
  const intro = options.afterHours
    ? `Thanks for calling ${line.brandName}. We're closed right now, and ${line.ownerName} will call you back first thing tomorrow.`
    : `Thanks for calling ${line.brandName}. ${line.ownerName} can't get to the phone right now and will call you back shortly.`;
  response.say(`${intro} This call is recorded so ${line.ownerName} has your details. After the tone, ${line.recoveryAsk}.`);
  response.record({
    maxLength: 120,
    timeout: 5,
    playBeep: true,
    transcribe: true,
    transcribeCallback: urls.transcript,
    recordingStatusCallback: urls.recording,
    recordingStatusCallbackEvent: ["completed"],
    action: urls.recordDone,
    method: "POST",
  });
  return response.toString();
}

/**
 * Recovery when the line's configuration cannot be loaded (database down).
 * Neutral wording, same disclosure and callbacks: the caller is still captured.
 */
export function genericRecoveryTwiml(urls: VoiceUrls): string {
  const response = new VoiceResponse();
  response.say(
    "Thanks for calling. We can't get to the phone right now and will call you back shortly. " +
      "This call is recorded so we have your details. After the tone, please say your name, " +
      "your address, what you need, and the best time to reach you.",
  );
  response.record({
    maxLength: 120,
    timeout: 5,
    playBeep: true,
    transcribe: true,
    transcribeCallback: urls.transcript,
    recordingStatusCallback: urls.recording,
    recordingStatusCallbackEvent: ["completed"],
    action: urls.recordDone,
    method: "POST",
  });
  return response.toString();
}

export function recordDoneTwiml(line: Pick<LineConfig, "ownerName"> | null): string {
  const response = new VoiceResponse();
  response.say(line ? `Thank you. ${line.ownerName} will call you back.` : "Thank you. We will call you back.");
  response.hangup();
  return response.toString();
}

export function hangupTwiml(): string {
  const response = new VoiceResponse();
  response.hangup();
  return response.toString();
}

/** A number we do not recognise: apologise and hang up rather than ring nobody. */
export function unknownLineTwiml(): string {
  const response = new VoiceResponse();
  response.say("Sorry, this number is not in service. Goodbye.");
  response.hangup();
  return response.toString();
}

/**
 * The spam gate: hidden numbers, failed caller-ID checks and numbers flagged
 * as spam must press 1 or say yes. Robocalls don't; people do. Silence goes
 * to the message path, never to a hang-up (docs/research/spam-screening.md).
 */
export function screenCallerTwiml(brandName: string, urls: VoiceUrls): string {
  const response = new VoiceResponse();
  const gather = response.gather({
    input: ["dtmf", "speech"],
    numDigits: 1,
    timeout: 6,
    speechTimeout: "auto",
    hints: "yes, yeah, yep, sure, okay, si",
    action: urls.screenCaller,
    method: "POST",
    actionOnEmptyResult: true,
  });
  gather.say(`Thanks for calling ${brandName}. To reach us, please press 1, or say yes.`);
  return response.toString();
}

/** A number Amy blocked: refused before anyone answers, so it costs nothing. */
export function rejectTwiml(): string {
  const response = new VoiceResponse();
  response.reject({ reason: "busy" });
  return response.toString();
}

/**
 * Amy's leg of a callback: tells her who she's calling, then dials the
 * customer showing the business number, so they recognize who's calling back.
 */
export function callbackBridgeTwiml(input: { customerName: string | null; customerPhone: string | null; lineE164: string }): string {
  const response = new VoiceResponse();
  if (!input.customerPhone) {
    response.say("There's no phone number on file for this caller. Please check the lead in your dashboard.");
    response.hangup();
    return response.toString();
  }
  response.say(`Calling ${input.customerName ?? "the customer"} now.`);
  const dial = response.dial({ callerId: input.lineE164, answerOnBridge: true, timeout: 30 });
  dial.number(input.customerPhone);
  return response.toString();
}
