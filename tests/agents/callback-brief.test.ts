import { describe, expect, it } from "vitest";
import { callbackBrief } from "@/lib/agents/callback-brief";
import type { FactRow, LeadCard, LeadDetail, TimelineRow } from "@/lib/db/dashboard";

// The brief Amy reads before calling back: every line traces to stored data.
const AT = new Date("2026-10-22T20:00:00Z");

function lead(card: Partial<LeadCard>, facts: Array<Partial<FactRow>> = [], timeline: Array<Partial<TimelineRow>> = []): LeadDetail {
  return {
    card: {
      id: "11111111-1111-4111-8111-111111111111", businessId: "b", businessName: "Christmas Light Guys", businessKind: "company",
      intent: "warm", state: "new", source: "agent_call", campaignName: null, channel: "tv", contactName: "Priya Raman",
      contactPhone: "+15125550147", address: "88 Hidden Hills Dr, Dripping Springs", zip: null, serviceWanted: "roofline and two trees",
      timing: null, callbackWindow: "weekday mornings", mapsVisible: null, propertyType: "residential", customerType: "new", statedSource: null,
      summary: null, needsReview: false, compliance: { missing: ["caller_email", "outdoor_plugs"] }, openTaskId: null,
      taskPriority: null, taskWindow: null, lastCallState: null, transferred: false, createdAt: AT, ...card,
    },
    facts: facts.map((f) => ({ field: "notes", value: "", source: "caller_via_agent", createdAt: AT, current: true, ...f }) as FactRow),
    calls: [], sessions: [], tools: [], incidents: [],
    timeline: timeline.map((e, i) => ({ id: i, type: "", actorType: "agent", payload: {}, occurredAt: AT, ...e }) as TimelineRow),
  };
}

describe("before-you-call brief", () => {
  it("opens with the caller's name, the company, what they asked for and where", () => {
    const brief = callbackBrief(lead({}), "Amy", "The Christmas Light Guys");
    expect(brief.opener).toBe(
      "Hi Priya, it's Amy with The Christmas Light Guys. You talked with our assistant about roofline and two trees at 88 Hidden Hills Dr. Is now still a good time?",
    );
    expect(brief.missing).toEqual(["Email", "Outdoor plugs"]);
  });

  it("lists the questions only Amy can answer, newest wording first, without repeats", () => {
    const brief = callbackBrief(
      lead({}, [
        { value: "Asked: Do you use clips or nails?", current: false },
        { value: "Asked: How much for the roofline?", current: false },
        { value: "Asked: do you use clips or nails?", current: true },
      ]),
      "Amy",
      "The Christmas Light Guys",
    );
    expect(brief.asked).toEqual(["do you use clips or nails?", "How much for the roofline?"]);
  });

  it("warns that nothing was quoted or promised when they asked about price or a date", () => {
    const brief = callbackBrief(
      lead({ timing: "before Thanksgiving", compliance: { summary: { priceAsked: true, priceStated: false, dateRequested: true, availabilityPromised: false, humanRequested: true } } }),
      "Jordan",
      "The Christmas Light Guys",
    );
    expect(brief.careful).toEqual([
      "They asked about price. Nothing was quoted, so they're expecting you to walk them through it.",
      "They'd like it before Thanksgiving. Nothing was promised: check the schedule before you commit.",
      "They asked to talk with Jordan directly.",
    ]);
  });

  it("an urgent report changes the opener and comes first", () => {
    const brief = callbackBrief(
      lead({}, [], [{ type: "call.flagged_urgent", payload: { kind: "safety", summary: "Strand on the roof sparking" } }]),
      "Amy",
      "The Christmas Light Guys",
    );
    expect(brief.opener).toContain("calling you right back about what you reported. Is everyone okay?");
    expect(brief.careful[0]).toBe("Urgent (Safety): Strand on the roof sparking");
  });

  it("a do-not-contact request means no opener and a stop line first", () => {
    const brief = callbackBrief(lead({}, [{ value: "do not contact" }]), "Amy", "The Christmas Light Guys");
    expect(brief.doNotContact).toBe(true);
    expect(brief.opener).toBeNull();
    expect(brief.careful[0]).toMatch(/asked not to be contacted/);
  });

  it("web and voicemail leads open the right way; an unknown need just returns the call", () => {
    expect(callbackBrief(lead({ source: "web_form" }), "Amy", "X").opener).toContain("You asked for a quote on our website about");
    expect(callbackBrief(lead({ source: "call_recovery" }), "Amy", "X").opener).toContain("You left us a message about");
    expect(callbackBrief(lead({ serviceWanted: null, contactName: null }), "Amy", "X").opener).toBe("Hi, it's Amy with X, returning your call. How can I help?");
  });
});

describe("The callback lead sheet (Amy, 2026-10-29)", () => {
  const facts = [
    { field: "maps_visible" as const, value: "yes" },
    { field: "home_size" as const, value: "about 2,500" },
  ];

  it("lists her fields in her order, says whether a visit is needed, and that nothing was quoted or promised", () => {
    const brief = callbackBrief(
      lead({ summary: "Priya wants the roofline and two trees. The house is easy to see on Google Maps." }, facts),
      "Amy",
      "The Christmas Light Guys",
      { callback: "Josh", propertyLines: true },
    );
    expect(brief.sheet).toEqual([
      { label: "Name", value: "Priya Raman" },
      { label: "Phone", value: "(512) 555-0147" },
      { label: "Property address", value: "88 Hidden Hills Dr, Dripping Springs" },
      { label: "Customer type", value: "Residential" },
      { label: "Interest", value: "roofline and two trees" },
      { label: "Home visible on Google Maps", value: "Yes" },
      { label: "Square footage", value: "about 2,500" },
      { label: "Preferred callback", value: "weekday mornings" },
      { label: "Site visit", value: "Probably not: visible on Google Maps" },
      { label: "Pricing discussed", value: "No" },
      { label: "Promises made", value: "None" },
      { label: "Summary", value: "Priya wants the roofline and two trees. The house is easy to see on Google Maps." },
      { label: "Next action", value: "Josh callback" },
    ]);
    expect(brief.opener).toMatch(/^Hi Priya, it's Josh with The Christmas Light Guys\./);
  });

  it("a home that's hard to see on Google Maps is a site visit to set up on the callback (Amy, 2026-10-29)", () => {
    const brief = callbackBrief(lead({}, [{ field: "maps_visible", value: "no" }]), "Amy", "The Christmas Light Guys", {
      callback: "Amy",
      propertyLines: true,
    });
    const line = (label: string) => brief.sheet.find((l) => l.label === label)?.value;
    expect(line("Site visit")).toBe("Yes: set up a time on the callback (hard to see on Google Maps)");
    expect(line("Next action")).toBe("Call to set up the site visit");
    expect(brief.opener).toMatch(/^Hi Priya, it's Amy with The Christmas Light Guys/);
  });

  it("anything the scan caught shows as a promise to check; urgent reports go back to Amy", () => {
    const flagged = callbackBrief(
      lead({ compliance: { violations: [{ code: "site_visit_offered" }, { code: "price_stated" }], summary: { priceAsked: true, priceStated: true, dateRequested: false, availabilityPromised: false, humanRequested: false } } }),
      "Amy",
      "The Christmas Light Guys",
      { callback: "Josh", propertyLines: true },
    );
    const line = (label: string) => flagged.sheet.find((l) => l.label === label)?.value;
    expect(line("Pricing discussed")).toBe("Yes: check the transcript");
    expect(line("Promises made")).toBe("Check the transcript: a site visit, a price");
    expect(line("Home visible on Google Maps")).toBe("Not asked");

    const urgent = callbackBrief(
      lead({}, [], [{ type: "call.flagged_urgent", payload: { kind: "service_issue", summary: "Roofline dark" } }]),
      "Amy",
      "The Christmas Light Guys",
      { callback: "Josh", propertyLines: true },
    );
    expect(urgent.opener).toMatch(/^Hi Priya, it's Amy with/);
    expect(urgent.sheet.at(-1)).toEqual({ label: "Next action", value: "Amy callback (urgent)" });
  });
});
