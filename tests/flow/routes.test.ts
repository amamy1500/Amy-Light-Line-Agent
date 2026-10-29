import { signLikeTwilio } from "@/lib/telephony";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Exercises the real Next.js route modules, including signature checks
// against PUBLIC_BASE_URL (not the internal request URL).
const PUBLIC = "https://clg.example.test";
const TOKEN = "route-test-token";
const saved = { ...process.env };

beforeAll(() => {
  process.env.PUBLIC_BASE_URL = PUBLIC;
  process.env.TWILIO_AUTH_TOKEN = TOKEN;
  delete process.env.DATABASE_URL;
  delete process.env.PGLITE_DIR; // in-memory embedded database, seeded with 555-01xx numbers
});
afterAll(() => {
  process.env = saved;
});

function twilioPost(path: string, params: Record<string, string>, opts: { signFor?: string; token?: string; signature?: string | null } = {}) {
  const body = new URLSearchParams(params);
  const signature =
    opts.signature !== undefined ? opts.signature : signLikeTwilio(opts.token ?? TOKEN, opts.signFor ?? `${PUBLIC}${path}`, params);
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded" };
  if (signature) headers["x-twilio-signature"] = signature;
  // The server sees its internal URL; verification must use the public one.
  return new Request(`http://127.0.0.1:3000${path}`, { method: "POST", headers, body });
}

describe("POST /api/voice/inbound", () => {
  const params = { CallSid: `CA${"a".repeat(32)}`, From: "+15125550147", To: "+15125550101" };

  it("answers a correctly signed Twilio request with the ring-Amy TwiML", async () => {
    const { POST } = await import("@/app/api/voice/inbound/route");
    const res = await POST(twilioPost("/api/voice/inbound", params));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/xml");
    const xml = await res.text();
    expect(xml).toMatch(/<Dial|We're closed right now/); // depends on the wall clock in Austin
  });

  it("rejects unsigned, mis-signed and wrong-URL requests with 403", async () => {
    const { POST } = await import("@/app/api/voice/inbound/route");
    expect((await POST(twilioPost("/api/voice/inbound", params, { signature: null }))).status).toBe(403);
    expect((await POST(twilioPost("/api/voice/inbound", params, { token: "wrong-token" }))).status).toBe(403);
    expect((await POST(twilioPost("/api/voice/inbound", params, { signFor: "http://127.0.0.1:3000/api/voice/inbound" }))).status).toBe(403);
  });

  it("rejects everything when the auth token is not configured", async () => {
    const { POST } = await import("@/app/api/voice/inbound/route");
    delete process.env.TWILIO_AUTH_TOKEN;
    try {
      expect((await POST(twilioPost("/api/voice/inbound", params))).status).toBe(403);
    } finally {
      process.env.TWILIO_AUTH_TOKEN = TOKEN;
    }
  });
});

describe("POST /api/leads/web", () => {
  it("a real request becomes a lead with facts and a callback; bad input goes back with a message", async () => {
    const { findWebLine } = await import("@/lib/db");
    const { getDb } = await import("@/lib/server/db");
    const { formStamp } = await import("@/lib/server/form-guard");
    const line = await findWebLine(await getDb());
    expect(line?.phoneE164).toBe("+15125550102");
    const stamp = formStamp("development-only-form-secret", Date.now() - 10_000);

    const { POST } = await import("@/app/api/leads/web/route");
    let ip = 10;
    const form = (fields: Record<string, string>) =>
      new Request("http://127.0.0.1:3000/api/leads/web", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", "x-forwarded-for": `203.0.113.${ip++}` },
        body: new URLSearchParams(fields),
      });

    const ok = await POST(form({ campaign: line!.campaignId, stamp, name: "Jordan", phone: "(512) 555-0177", address: "77 Elm Street", service: "roofline and two trees", utm_source: "qr" }));
    expect(ok.status).toBe(303);
    expect(ok.headers.get("location")).toBe(`${PUBLIC}/thanks`);

    const bad = await POST(form({ campaign: line!.campaignId, stamp, name: "Jordan", phone: "555", address: "77 Elm Street" }));
    expect(bad.headers.get("location")).toContain("error=");

    const db = await getDb();
    const leads = await db.query<{ id: string; service_wanted: string; attribution: Record<string, string> }>(
      "select id, service_wanted, attribution from public.lead where source = 'web_form' and contact_phone = '+15125550177'",
    );
    expect(leads.rows).toHaveLength(1);
    expect(leads.rows[0]).toMatchObject({ service_wanted: "roofline and two trees", attribution: { utm_source: "qr" } });
    const task = await db.query<{ n: number | string }>("select count(*) as n from public.task where lead_id = $1 and status = 'open'", [leads.rows[0]!.id]);
    expect(Number(task.rows[0]!.n)).toBe(1);
  });

  it("drops bots without telling them: honeypot, no stamp, forged or instant stamp, link spam", async () => {
    const { findWebLine } = await import("@/lib/db");
    const { getDb } = await import("@/lib/server/db");
    const { formStamp } = await import("@/lib/server/form-guard");
    const { POST } = await import("@/app/api/leads/web/route");
    const line = await findWebLine(await getDb());
    const good = formStamp("development-only-form-secret", Date.now() - 10_000);
    const base = { campaign: line!.campaignId, name: "Bot", phone: "(512) 555-0166", address: "1 Spam Street" };
    let ip = 50;
    const post = (fields: Record<string, string>) =>
      POST(new Request("http://127.0.0.1:3000/api/leads/web", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", "x-forwarded-for": `198.51.100.${ip++}` },
        body: new URLSearchParams(fields),
      }));
    const attempts = [
      { ...base, stamp: good, company: "spam inc" },
      { ...base },
      { ...base, stamp: `${Date.now() - 10_000}.forgedmacforgedmacforgedmacforge` },
      { ...base, stamp: formStamp("development-only-form-secret", Date.now()) },
      { ...base, stamp: good, service: "Rank your website! visit https://seo.example" },
    ];
    for (const fields of attempts) {
      const res = await post(fields);
      expect(res.headers.get("location")).toBe(`${PUBLIC}/thanks`);
    }
    const { rows } = await (await getDb()).query<{ n: number | string }>(
      "select count(*) as n from public.lead where contact_phone = '+15125550166'",
    );
    expect(Number(rows[0]!.n)).toBe(0);
  });
});
