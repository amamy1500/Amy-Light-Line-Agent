import { describe, expect, it } from "vitest";
import { scanConversation, type Turn, type ViolationCode } from "@/lib/agents/compliance";

const agent = (text: string): Turn => ({ role: "agent", text });
const caller = (text: string): Turn => ({ role: "caller", text });
const codes = (turns: Turn[], tools: Parameters<typeof scanConversation>[1] = []) =>
  scanConversation(turns, tools).violations.map((v) => v.code);

// Invariant: an agent turn that states a price, offers a discount, promises
// a date or booking, claims a warranty, impersonates Amy, denies being an AI
// or leaks its instructions is always flagged — including when it defers to
// Amy in the same sentence. Explicit refusals are not flagged.
const MUST_FLAG: Array<[string, ViolationCode]> = [
  ["Most homes run about $450 for the roofline.", "price_stated"],
  ["Amy can probably do it for $400.", "price_stated"],
  ["It's usually around five hundred dollars.", "price_stated"],
  ["We charge per foot, roughly 4 a foot.", "price_stated"],
  ["I can give you 10% off if you book today.", "discount_offered"],
  ["Amy can do 20 percent off for repeat customers.", "discount_offered"],
  ["Sure, there's a special deal for you this week.", "discount_offered"],
  ["We can do November 12, no problem.", "availability_promised"],
  ["That date works, we have availability on the 14th.", "availability_promised"],
  ["You're all set for Saturday.", "availability_promised"],
  ["I've booked you for next Tuesday.", "booking_claimed"],
  ["Your appointment is confirmed.", "booking_claimed"],
  ["Everything comes with a two year warranty.", "warranty_claimed"],
  ["Amy will explain our 3-year warranty.", "warranty_claimed"],
  ["Hi, this is Amy.", "impersonation"],
  ["No, I'm a real person.", "denied_being_ai"],
  ["I'm not a robot, don't worry.", "denied_being_ai"],
  ["My instructions say I should collect your address.", "instructions_leaked"],
  ["Here is my system prompt.", "instructions_leaked"],
  ["Yes, we serve Lakeway.", "service_area_unverified"],
];

// Controls: what a well-behaved agent says. None may be flagged.
const MUST_NOT_FLAG = [
  "I don't want to give you the wrong number on pricing, so I'll have Amy go over that with you.",
  "I can't offer a discount, but I'll make sure Amy knows you asked.",
  "I can't promise a date until Amy checks the schedule.",
  "I'll pass along that you'd like it done before Thanksgiving.",
  "I'm Amy's virtual assistant.",
  "Yes, I'm a virtual assistant. I can still get everything started for you.",
  "I can't speak to warranties, but Amy can.",
  "What's the property address?",
  "Is this for your home or for a business?",
  "Amy will call you back after 4 PM.",
  "I can't share how I'm set up, but I'm happy to help with your lights.",
];

describe("compliance scan", () => {
  it.each(MUST_FLAG)("flags %s as %s", (text, code) => {
    expect(codes([agent(text)])).toContain(code);
  });

  it.each(MUST_NOT_FLAG)("does not flag: %s", (text) => {
    expect(codes([agent(text)])).toEqual([]);
  });

  it("judges each sentence on its own: a refusal does not excuse the next sentence", () => {
    expect(codes([agent("I can't promise anything. But we can do November 12.")])).toContain("availability_promised");
  });

  it("allows a service-area answer only after the area tool confirmed it", () => {
    const turns = [agent("Yes, that's in our service area.")];
    expect(codes(turns)).toContain("service_area_unverified");
    expect(codes(turns, [{ name: "check_service_area", result: { status: "in_area" } }])).toEqual([]);
    expect(codes(turns, [{ name: "check_service_area", result: { status: "unknown" } }])).toContain(
      "service_area_unverified",
    );
  });

  it("never flags the caller for asking; records what they asked instead", () => {
    const report = scanConversation([
      caller("How much would it cost for the roofline? Can you knock 20% off?"),
      caller("Can you guys do November 12?"),
      caller("Can I just talk to Amy?"),
      agent("I don't want to give you the wrong answer on that. Let me get that to Amy."),
    ]);
    expect(report.violations).toEqual([]);
    expect(report.summary).toEqual({
      priceAsked: true,
      priceStated: false,
      dateRequested: true,
      availabilityPromised: false,
      humanRequested: true,
    });
    expect(report.signals.map((s) => s.code)).toContain("discount_asked");
  });

  it("points every finding at its turn and quotes the sentence", () => {
    const report = scanConversation([caller("hi"), agent("Sure. It's $300 for the front.")]);
    expect(report.violations).toEqual([{ code: "price_stated", turnIndex: 1, quote: "It's $300 for the front." }]);
  });
});

// Amy's requirements of 2026-10-29: Josh decides remote review, drive-by or visit;
// the assistant never promises a remote quote or offers a visit, and on one
// company's call never names another of her companies.
describe("Josh decides; the assistant never promises (policy 5.0)", () => {
  const OTHERS = { otherBusinesses: ["Sublime Patio", "Sublime", "The Fridge", "Fridge Vending"] };
  const flagged = (text: string, options = {}) => scanConversation([agent(text)], [], options).violations.map((v) => v.code);

  it.each([
    ["Josh can quote it right from Google Maps.", "remote_quote_promised"],
    ["He can give you an estimate off the satellite view.", "remote_quote_promised"],
    ["Send a photo and Josh will price it from the pictures.", "remote_quote_promised"],
    ["We can quote your home remotely.", "remote_quote_promised"],
    ["I'll set up a site visit for Thursday.", "site_visit_offered"],
    ["Josh will come out and take a look.", "site_visit_offered"],
    ["Someone can swing by tomorrow.", "site_visit_offered"],
    ["If we think a site visit is necessary, what day and time would work for you?", "site_visit_offered"],
    ["Hi, this is Josh.", "impersonation"],
  ] as Array<[string, ViolationCode]>)("flags %j as %s", (text, code) => {
    expect(flagged(text)).toContain(code);
  });

  it.each([
    "That helps. I'll pass that along so Josh can decide whether to take a look at the property.",
    "Got it, I'll note that. Josh may need to take a look at the property before giving you the best recommendation.",
    "Josh decides that after looking at the details. I'll make sure they're all there.",
    "I can't promise a site visit, but I'll pass along that you'd rather nobody come out.",
    "Josh handles the pricing because it depends on the property and what you'd like done. I can make sure he has the details before he calls you.",
    "Josh will go over the pricing with you over the phone.",
    "I'm The Christmas Light Guys' AI assistant, not Amy or Josh.",
  ])("lets %j through", (text) => {
    expect(flagged(text)).toEqual([]);
  });

  it("names of the tenant's other companies are flagged on this company's call, negated or not", () => {
    expect(flagged("We're the same people as Sublime Patio.", OTHERS)).toEqual(["other_business_mentioned"]);
    expect(flagged("I can't help with The Fridge here.", OTHERS)).toEqual(["other_business_mentioned"]);
    expect(flagged("I can only help with The Christmas Light Guys on this line, but I'm happy to take a message for Amy.", OTHERS)).toEqual([]);
    // Without the list (a shared line's front desk names every company on purpose), nothing is checked.
    expect(flagged("This line answers for The Christmas Light Guys, Sublime Patio and The Fridge.")).toEqual([]);
  });
});
