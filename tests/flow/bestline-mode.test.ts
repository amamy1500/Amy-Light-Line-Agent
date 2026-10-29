import { beforeAll, describe, expect, it } from "vitest";
import { simulatorConnector } from "@/lib/agents/connector";
import { runTool } from "@/lib/agents/gateway";
import { seedOffice, type Queryable } from "@/lib/db";
import { getCallContext } from "@/lib/db/agent";
import { loadActiveConfig } from "@/lib/db/config";
import { officeBusinesses } from "@/lib/db/dashboard";
import { openPglite } from "@/lib/db/pglite";
import { handleInbound, type VoiceDeps } from "@/lib/server/voice";
import { missingKeys } from "@/scripts/live/setup";

// Bestline mode: callers keep dialing 512-339-9313 and Bestline forwards to
// two numbers of ours that nobody publishes. No company has its own number.
const BESTLINE_MISSED = "+15125550111"; // after Amy's phone rang and she didn't answer
const BESTLINE_ALL = "+15125550112"; // forward-all / app offline: we ring Amy first
const AMY = "+15125550199";
const DAYTIME = new Date("2026-10-20T18:00:00Z"); // Tue 1:00 pm in Austin

let db: Queryable;
let seq = 0;
const sid = () => `CA${(0xb000 + ++seq).toString(16).padStart(32, "0")}`;
const voice = (): VoiceDeps => ({ db, now: () => DAYTIME, baseUrl: "https://clg.example.test", agent: simulatorConnector() });
const param = (twiml: string, name: string) => new RegExp(`name="${name}" value="([^"]*)"`).exec(twiml)?.[1] ?? null;

beforeAll(async () => {
  db = await openPglite();
  await seedOffice(db, {
    ownerName: "Amy",
    ownerRingE164: AMY,
    numbers: { tv: "+15125550101", web: "+15125550102", print: "+15125550103" },
    ringStart: "09:00",
    ringEnd: "18:00",
    aiMode: "overflow",
    agentId: "agent_office",
    maxConcurrentSessions: 20,
    office: { bestlineMissed: BESTLINE_MISSED, sharedLine: BESTLINE_ALL },
  });
});

describe("Bestline mode (512-339-9313 forwards to two hidden numbers)", () => {
  it("all three companies exist even without numbers of their own, with one front desk for both lines", async () => {
    const businesses = await officeBusinesses(db);
    expect(businesses.filter((b) => b.kind === "company").map((b) => b.name).sort()).toEqual([
      "Christmas Light Guys",
      "Sublime Patio",
      "The Fridge",
    ]);
    expect(businesses.filter((b) => b.kind === "front_desk")).toHaveLength(1);
    const { rows } = await db.query<{ e164: string; ring_owner: boolean }>(
      "select e164, ring_owner from public.tracking_number where e164 = any($1) order by e164",
      [[BESTLINE_MISSED, BESTLINE_ALL]],
    );
    expect(rows).toEqual([
      { e164: BESTLINE_MISSED, ring_owner: false },
      { e164: BESTLINE_ALL, ring_owner: true },
    ]);
  });

  it("a missed call Bestline forwards is answered at once, asks which company, and files it there", async () => {
    const call = sid();
    const twiml = await handleInbound({ CallSid: call, From: "+15125550301", To: BESTLINE_MISSED }, voice());
    expect(twiml).not.toContain("<Dial"); // Amy already rang at Bestline
    expect(param(twiml, "entry")).toBe("owner_unavailable");
    expect(param(twiml, "opening")).toContain("The Christmas Light Guys, Sublime Patio or The Fridge?");
    const deps = {
      db,
      now: DAYTIME,
      loadConfig: async (id: string) => (await loadActiveConfig(db, id))?.config ?? null,
      scheduleHandoff: async () => {},
    };
    const chosen = await runTool("select_business", { call_sid: call, caller_words: "Christmas lights on the house" }, deps);
    expect(chosen.body).toMatchObject({ status: "set", company: "The Christmas Light Guys" });
    const ctx = (await getCallContext(db, call))!;
    expect(ctx.businessName).toBe("Christmas Light Guys");
  });

  it("forward-all (or app offline) still rings Amy first, with the press-1 screen", async () => {
    const twiml = await handleInbound({ CallSid: sid(), From: "+15125550302", To: BESTLINE_ALL }, voice());
    expect(twiml).toContain("<Dial");
    expect(twiml).toContain(AMY);
  });

  it("live setup accepts the Bestline numbers alone; no company number is required", () => {
    const base = { TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "t", ELEVENLABS_API_KEY: "k", AGENT_TOOL_SECRET: "s", PUBLIC_BASE_URL: "https://x" };
    expect(missingKeys({ ...base, BESTLINE_MISSED_NUMBER: BESTLINE_MISSED })).toEqual([]);
    expect(missingKeys(base)).toHaveLength(1); // at least one number to answer
  });
});
