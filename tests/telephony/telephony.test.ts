import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  acceptsCall,
  decideAfterDial,
  formatUsPhone,
  handoffScreenTwiml,
  isValidTwilioSignature,
  isWithinRingWindow,
  normalizeUsPhone,
  parseClock,
  recoveryTwiml,
  ringOwnerTwiml,
  screenAcceptTwiml,
  screenTwiml,
  signLikeTwilio,
  voiceUrls,
  type LineConfig,
} from "@/lib/telephony";

const LINE: LineConfig = {
  brandName: "The Christmas Light Guys",
  ownerName: "Amy",
  ownerPhone: "+15125550199",
  sourceLabel: "TV",
  ringTimeoutSeconds: 20,
  recoveryAsk: "please say your name, your address, what you'd like lit, and the best time to reach you",
};
const URLS = voiceUrls("https://clg.example.test");

describe("call flow TwiML", () => {
  it("rings the owner with a screened <Number> and reports back to dial-result", () => {
    const xml = ringOwnerTwiml(LINE, URLS);
    expect(xml).toContain('<Dial timeout="20" answerOnBridge="true" action="https://clg.example.test/api/voice/dial-result" method="POST">');
    expect(xml).toContain('<Number url="https://clg.example.test/api/voice/screen" method="POST">+15125550199</Number>');
  });

  it("the screen whispers the source, requires a keypress, and hangs up without one", () => {
    const xml = screenTwiml(LINE, URLS);
    expect(xml).toMatch(/<Gather numDigits="1" finishOnKey="" timeout="8" action="https:\/\/clg\.example\.test\/api\/voice\/screen-accept"/);
    expect(xml).toContain("The Christmas Light Guys call from TV. Press any key to take it.");
    expect(xml.trim().endsWith("</Gather><Hangup/></Response>")).toBe(true);
  });

  it("any single key bridges, # and * included; no key (her voicemail) hangs up the owner's leg", () => {
    for (const digits of ["1", "0", "5", "9", "*", "#"]) {
      expect(acceptsCall(digits), digits).toBe(true);
      expect(screenAcceptTwiml(digits), digits).not.toContain("<Hangup");
    }
    for (const digits of [undefined, "", "11", "a", " "]) {
      expect(acceptsCall(digits), String(digits)).toBe(false);
      expect(screenAcceptTwiml(digits), String(digits)).toContain("<Hangup/>");
    }
  });

  it("the hand-off screen asks for any key too", () => {
    const xml = handoffScreenTwiml("The Christmas Light Guys", "Sarah, roofline", URLS);
    expect(xml).toContain('finishOnKey=""');
    expect(xml).toContain("Sarah, roofline. Press any key to take it.");
    expect(xml).not.toContain("Press 1");
  });

  it("recovery discloses recording before the beep and wires both callbacks", () => {
    const xml = recoveryTwiml(LINE, URLS, { afterHours: false });
    const sayAt = xml.indexOf("This call is recorded");
    const recordAt = xml.indexOf("<Record");
    expect(sayAt).toBeGreaterThan(-1);
    expect(sayAt).toBeLessThan(recordAt);
    expect(xml).toContain('maxLength="120"');
    expect(xml).toContain('transcribe="true"');
    expect(xml).toContain('transcribeCallback="https://clg.example.test/api/voice/transcript"');
    expect(xml).toContain('recordingStatusCallback="https://clg.example.test/api/voice/recording"');
    expect(xml).toContain("can't get to the phone right now");
  });

  it("after-hours recovery promises a morning callback, not 'shortly'", () => {
    const xml = recoveryTwiml(LINE, URLS, { afterHours: true });
    expect(xml).toContain("We're closed right now");
    expect(xml).toContain("first thing tomorrow");
    expect(xml).not.toContain("shortly");
  });

  it("escapes brand text so a name with '&' cannot break the XML", () => {
    const xml = screenTwiml({ ...LINE, brandName: "Lights & <Co>" }, URLS);
    expect(xml).toContain("Lights &amp; &lt;Co&gt;");
  });
});

describe("decideAfterDial (mirrors app.resolve_dial)", () => {
  it.each([
    [true, "owner_answered"],
    ["true", "owner_answered"],
    [false, "recovery"],
    ["false", "recovery"],
    [undefined, "recovery"],
    [null, "recovery"],
    ["TRUE", "recovery"],
  ] as const)("DialBridged=%s → %s", (bridged, outcome) => {
    expect(decideAfterDial(bridged)).toBe(outcome);
  });
});

describe("ring window", () => {
  const window = { timezone: "America/Chicago", start: "08:00", end: "20:00" };

  it("uses Austin local time across daylight-saving changes", () => {
    // 2026-11-02 14:30 UTC = 08:30 CST (after DST ends); 2026-10-20 13:30 UTC = 08:30 CDT.
    expect(isWithinRingWindow(new Date("2026-11-02T14:30:00Z"), window)).toBe(true);
    expect(isWithinRingWindow(new Date("2026-10-20T13:30:00Z"), window)).toBe(true);
    // 07:59 local is outside; 20:00 local is outside (end exclusive).
    expect(isWithinRingWindow(new Date("2026-10-20T12:59:00Z"), window)).toBe(false);
    expect(isWithinRingWindow(new Date("2026-10-21T01:00:00Z"), window)).toBe(false);
  });

  it("supports windows that cross midnight and the always-ring window", () => {
    const overnight = { timezone: "UTC", start: "20:00", end: "02:00" };
    expect(isWithinRingWindow(new Date("2026-10-20T23:00:00Z"), overnight)).toBe(true);
    expect(isWithinRingWindow(new Date("2026-10-20T01:59:00Z"), overnight)).toBe(true);
    expect(isWithinRingWindow(new Date("2026-10-20T12:00:00Z"), overnight)).toBe(false);
    expect(isWithinRingWindow(new Date("2026-10-20T03:00:00Z"), { timezone: "UTC", start: "00:00", end: "00:00" })).toBe(true);
  });

  it("(property) a normal window contains exactly the minutes in [start, end)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1438 }), fc.integer({ min: 1, max: 1439 }), fc.integer({ min: 0, max: 1439 }), (s, len, t) => {
        const start = s;
        const end = Math.min(1439, s + len);
        fc.pre(end > start);
        const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
        const now = new Date(Date.UTC(2026, 9, 20, Math.floor(t / 60), t % 60));
        expect(isWithinRingWindow(now, { timezone: "UTC", start: clock(start), end: clock(end) })).toBe(t >= start && t < end);
      }),
    );
  });

  it("rejects malformed clock strings and accepts Postgres time text", () => {
    expect(parseClock("08:00:00")).toBe(480);
    expect(() => parseClock("8am")).toThrow(/Invalid clock/);
    expect(() => parseClock("24:00")).toThrow(/Invalid clock/);
  });
});

describe("Twilio signature verification fails closed", () => {
  const token = "test-auth-token";
  const url = "https://clg.example.test/api/voice/inbound";
  const params = { CallSid: "CA123", From: "+15125550147", To: "+15125550101" };
  const signature = signLikeTwilio(token, url, params);

  it("accepts a correctly signed request", () => {
    expect(isValidTwilioSignature({ authToken: token, signature, url, params })).toBe(true);
  });

  it("rejects a missing token instead of skipping the check", () => {
    expect(isValidTwilioSignature({ authToken: undefined, signature, url, params })).toBe(false);
    expect(isValidTwilioSignature({ authToken: "", signature, url, params })).toBe(false);
  });

  it("rejects a missing or wrong signature, tampered params, or a different URL", () => {
    expect(isValidTwilioSignature({ authToken: token, signature: null, url, params })).toBe(false);
    expect(isValidTwilioSignature({ authToken: token, signature: "bogus", url, params })).toBe(false);
    expect(isValidTwilioSignature({ authToken: token, signature, url, params: { ...params, From: "+15125550100" } })).toBe(false);
    expect(isValidTwilioSignature({ authToken: token, signature, url: `${url}?x=1`, params })).toBe(false);
  });
});

describe("US phone numbers", () => {
  it("normalises common formats to E.164 and rejects non-numbers", () => {
    expect(normalizeUsPhone("(512) 555-0147")).toBe("+15125550147");
    expect(normalizeUsPhone("1-512-555-0147")).toBe("+15125550147");
    expect(normalizeUsPhone("+1 512.555.0147")).toBe("+15125550147");
    expect(normalizeUsPhone("555-0147")).toBeNull();
    expect(normalizeUsPhone("012-555-0147")).toBeNull();
    expect(normalizeUsPhone("")).toBeNull();
  });

  it("formats E.164 for people", () => {
    expect(formatUsPhone("+15125550147")).toBe("(512) 555-0147");
    expect(formatUsPhone(null)).toBe("unknown number");
  });
});
