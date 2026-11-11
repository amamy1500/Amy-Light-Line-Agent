import { describe, expect, it } from "vitest";
import type { PendingAlert } from "@/lib/db";
import { renderAlert, senderFromEnv } from "@/lib/server/alerts";
import { readEnv } from "@/lib/server/env";

// The lead email in Amy's Gmail (Pavan, 2026-11-09): who to call back and when, the job, what happened,
// the call recording attached, and the whole conversation.
const BASE = "https://clg.example.test";
const LEAD = "11111111-1111-4111-8111-111111111111";

const lead = (over: Partial<PendingAlert> = {}): PendingAlert => ({
  id: "a1", kind: "agent_lead", channel: "email", toAddress: "thelightguysaustin@gmail.com", attempts: 1, leadId: LEAD, callId: "c1",
  companyName: "The Christmas Light Guys", companyKind: "company", brandName: "The Christmas Light Guys", campaignName: "Christmas number",
  channelLabel: "main_line", contactPhone: "+15125550147", contactName: "Sam Patel", address: "2014 Robs Glen, Austin, Texas 78704",
  serviceWanted: "Roofline lights and two wreaths", timing: null, callbackWindow: "this afternoon", hasRecording: false,
  summary: "Sam wants roofline lights and two wreaths; the house shows on Google Maps.", intent: "hot", email: null, siteVisit: null,
  mapsVisible: "yes", calledAt: new Date("2026-11-09T18:07:00Z"), timezone: "America/Chicago", recordingUrl: null,
  conversationId: "conv_123", agentProvider: "elevenlabs", recordingDeclined: false,
  transcript: [
    { role: "agent", message: "Hi, thank you for calling The Christmas Light Guys." },
    { role: "user", message: "A Christmas light for roof and two wreaths." },
    { role: "agent", message: null },
  ],
  detail: null,
  ...over,
});

const liveEnv = readEnv({
  NODE_ENV: "test", PUBLIC_BASE_URL: BASE, ALERT_MODE: "live", RESEND_API_KEY: "re_test", ALERT_EMAIL_FROM: "Lightline <alerts@example.test>",
  ELEVENLABS_API_KEY: "el_test", TWILIO_ACCOUNT_SID: "AC_test", TWILIO_AUTH_TOKEN: "twilio_test",
});

/** A fake network: the vendor's audio and Resend, recording every request. */
function network(audio: { status: number; bytes?: Uint8Array }) {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    requests.push({ url, init });
    if (url.includes("/audio") || url.endsWith(".mp3")) return new Response(audio.bytes ? (audio.bytes.slice().buffer as ArrayBuffer) : null, { status: audio.status });
    if (url === "https://api.resend.com/emails") return new Response(JSON.stringify({ id: "email_1" }), { status: 200 });
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
  const sent = () => {
    const call = requests.find((r) => r.url === "https://api.resend.com/emails");
    return call ? (JSON.parse(String(call.init!.body)) as Record<string, unknown> & { text: string; html: string; attachments?: Array<{ filename: string; content: string }> }) : null;
  };
  return { fetchImpl, requests, sent };
}

describe("the lead email", () => {
  it("puts who to call back and when first, then the job, what happened, and the conversation", () => {
    const { subject, body, html } = renderAlert(lead(), BASE);
    expect(subject).toMatch(/^The Christmas Light Guys · .*New customer call from Sam Patel, \(512\) 555-0147$/);
    expect(body.split("\n")[2]).toBe(
      "A new customer called The Christmas Light Guys, and the assistant took their details. Please give them a call back this afternoon.",
    );
    expect(body.indexOf("CALL BACK")).toBeLessThan(body.indexOf("THE JOB"));
    expect(body).toContain("Phone: (512) 555-0147\nBest time to call: this afternoon");
    expect(body).toContain("Address: 2014 Robs Glen, Austin, Texas 78704");
    expect(body).toContain("Google Maps: Easy to see");
    expect(body).toContain("Called: Mon, Nov 9, 12:07 PM"); // the business's time zone, not the server's
    expect(body).toContain(`Call back: ${BASE}/leads/${LEAD}`);
    expect(body).toContain("THE CONVERSATION\nAssistant: Hi, thank you for calling The Christmas Light Guys.\nCaller: A Christmas light for roof and two wreaths.");
    expect(body).not.toMatch(/undefined|null/);
    expect(html).toContain('<a href="tel:+15125550147"');
    expect(html).toContain("https://www.google.com/maps/search/?api=1&amp;query=2014%20Robs%20Glen%2C%20Austin%2C%20Texas%2078704");
  });

  it("escapes what callers say, so a name can't break the email", () => {
    const { html } = renderAlert(lead({ contactName: "<b>Sam</b> & Co", transcript: [{ role: "user", message: '<script>alert("x")</script>' }] }), BASE);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;b&gt;Sam&lt;/b&gt; &amp; Co");
  });

  it("says plainly when the caller asked not to be recorded", () => {
    const { body } = renderAlert(lead({ recordingDeclined: true, transcript: null }), BASE);
    expect(body).toContain("The caller asked not to be recorded, so there's no recording or transcript.");
    expect(body).not.toContain("THE CONVERSATION");
  });
});

describe("sending the lead email", () => {
  it("attaches the call recording from the voice vendor", async () => {
    const net = network({ status: 200, bytes: new Uint8Array([73, 68, 51, 4]) });
    expect(await senderFromEnv(liveEnv, { fetchImpl: net.fetchImpl }).send(lead(), renderAlert(lead(), BASE))).toBe("sent");
    expect(net.requests[0]!.url).toBe("https://api.elevenlabs.io/v1/convai/conversations/conv_123/audio");
    const email = net.sent()!;
    expect(email).toMatchObject({ to: ["thelightguysaustin@gmail.com"], from: "Lightline <alerts@example.test>" });
    expect(email.attachments).toEqual([{ filename: "call-2026-11-09-sam-patel.mp3", content: Buffer.from([73, 68, 51, 4]).toString("base64") }]);
    expect(email.text).toContain("The call recording is attached (MP3)");
    expect(email.html).toContain("Open in Google Maps");
  });

  it("attaches a voicemail from Twilio, fetched with the account's credentials", async () => {
    const voicemail = lead({ kind: "message", conversationId: null, agentProvider: null, recordingUrl: "https://api.twilio.com/2010-04-01/Accounts/AC_test/Recordings/RE1" });
    const net = network({ status: 200, bytes: new Uint8Array([1, 2, 3]) });
    await senderFromEnv(liveEnv, { fetchImpl: net.fetchImpl }).send(voicemail, renderAlert(voicemail, BASE));
    const media = net.requests.find((r) => r.url.endsWith("RE1.mp3"))!;
    expect((media.init!.headers as Record<string, string>).authorization).toBe(`Basic ${Buffer.from("AC_test:twilio_test").toString("base64")}`);
    expect(net.sent()!.attachments).toHaveLength(1);
  });

  it("never fetches or attaches audio when the caller declined recording", async () => {
    const declined = lead({ recordingDeclined: true, transcript: null });
    const net = network({ status: 200, bytes: new Uint8Array([1]) });
    await senderFromEnv(liveEnv, { fetchImpl: net.fetchImpl }).send(declined, renderAlert(declined, BASE));
    expect(net.requests.map((r) => r.url)).toEqual(["https://api.resend.com/emails"]);
    expect(net.sent()!.attachments).toBeUndefined();
  });

  it("waits for audio the vendor hasn't finished, then sends without it rather than lose the lead", async () => {
    const early = network({ status: 404 });
    await expect(senderFromEnv(liveEnv, { fetchImpl: early.fetchImpl }).send(lead({ attempts: 1 }), renderAlert(lead(), BASE))).rejects.toThrow(/not ready/);
    expect(early.sent()).toBeNull();

    const late = network({ status: 404 });
    expect(await senderFromEnv(liveEnv, { fetchImpl: late.fetchImpl }).send(lead({ attempts: 3 }), renderAlert(lead(), BASE))).toBe("sent");
    expect(late.sent()!.attachments).toBeUndefined();
    expect(late.sent()!.text).toContain("The recording couldn't be attached this time.");
  });
});

describe("sending through the business Gmail", () => {
  const gmailEnv = readEnv({
    NODE_ENV: "test", PUBLIC_BASE_URL: BASE, ALERT_MODE: "live", ELEVENLABS_API_KEY: "el_test",
    GMAIL_USER: "thelightguysaustin@gmail.com", GMAIL_APP_PASSWORD: "abcd efgh ijkl mnop",
    // Resend set as well: Gmail still wins, so the email comes from Amy's own address.
    RESEND_API_KEY: "re_test", ALERT_EMAIL_FROM: "Lightline <alerts@example.test>",
  });

  it("takes the app password the way Google shows it, spaces and all", () => {
    expect(gmailEnv.gmailAppPassword).toBe("abcdefghijklmnop");
  });

  it("sends from the business Gmail to itself, with the recording attached, and never calls Resend", async () => {
    const net = network({ status: 200, bytes: new Uint8Array([73, 68, 51, 4]) });
    const mails: Array<Record<string, unknown>> = [];
    const smtp = { sendMail: async (message: Record<string, unknown>) => void mails.push(message) };
    expect(await senderFromEnv(gmailEnv, { fetchImpl: net.fetchImpl, smtp }).send(lead(), renderAlert(lead(), BASE))).toBe("sent");
    expect(net.sent()).toBeNull();
    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatchObject({
      from: { name: "The Christmas Light Guys (Lightline)", address: "thelightguysaustin@gmail.com" },
      to: "thelightguysaustin@gmail.com",
      subject: expect.stringContaining("Sam Patel"),
    });
    const [attachment] = mails[0]!.attachments as Array<{ filename: string; content: Buffer; contentType: string }>;
    expect(attachment).toMatchObject({ filename: "call-2026-11-09-sam-patel.mp3", contentType: "audio/mpeg" });
    expect([...attachment!.content]).toEqual([73, 68, 51, 4]);
    expect(String(mails[0]!.html)).toContain("Open in Google Maps");
  });

  it("says what's missing when no email sender is set up", async () => {
    const bare = readEnv({ NODE_ENV: "test", PUBLIC_BASE_URL: BASE, ALERT_MODE: "live" });
    await expect(senderFromEnv(bare).send(lead({ recordingDeclined: true }), renderAlert(lead(), BASE))).rejects.toThrow(/GMAIL_USER and GMAIL_APP_PASSWORD/);
  });
});
