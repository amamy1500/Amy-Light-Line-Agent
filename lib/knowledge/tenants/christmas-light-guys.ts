import siteFacts from "../sources/clg-site-facts.json";
import type { Brand, Claim, ItemKind, KnowledgeItem, Risk } from "../model";

/**
 * Tenant #1's knowledge items, built from the two public sites as captured on
 * 2026-10-22 (sources/clg-site-facts.json, 62 classified facts). Every claim
 * carries its quote and URL from that capture; nothing is retyped from memory.
 * All items start pending: the agent says none of it until Amy decides.
 */

interface SiteFact {
  id: string;
  fact: string;
  quote: string;
  source_url: string;
  sites: string[];
}

const FACTS = new Map((siteFacts as SiteFact[]).map((f) => [f.id, f]));

function site(id: string, brand: Brand, value: string, markers: string[], spoken?: string): Claim {
  const fact = FACTS.get(id);
  if (!fact) throw new Error(`site fact ${id} is not in the capture`);
  return { brand, value, quote: fact.quote, sourceUrl: fact.source_url, siteFactId: id, spoken: spoken ?? fact.quote, markers };
}

function item(def: {
  key: string;
  title: string;
  kind?: ItemKind;
  risk: Risk;
  topics: string[];
  callerQuestion: string;
  claims: Claim[];
  suggestedText?: string;
}): KnowledgeItem {
  return {
    kind: "fact",
    suggestedText: null,
    status: "pending",
    approvedText: null,
    approvedValue: null,
    decidedBy: null,
    decidedAt: null,
    ...def,
  };
}

const TLG_HOME = "https://thelightguysaustintx.com/";

export const CLG_KNOWLEDGE: KnowledgeItem[] = [
  item({
    key: "service_area",
    title: "Service area",
    kind: "service_area",
    risk: "high",
    topics: ["service area", "come out", "serve", "area", "location"],
    callerQuestion: "Do you guys come out to Lakeway?",
    claims: [
      site("F31", "clg", "Austin, Round Rock, Pflugerville, Georgetown, Leander + Travis, Williamson, Hays counties", []),
      site("F32", "tlg", "18 Central Texas cities incl. Lakeway, Bee Cave, Bastrop, Dripping Springs", []),
      site("F34", "clg", "Bastrop (Christmas site page titles only)", ["\\bbastrop\\b"], "Yes, we serve Bastrop."),
    ],
  }),
  item({
    key: "years_in_business",
    title: "Business history",
    risk: "high",
    topics: ["how long", "years", "experience", "in business", "history"],
    callerQuestion: "How long have you guys been doing this?",
    claims: [
      site("F27", "clg", "9 years", ["\\b(9|nine) years\\b"]),
      site("F28", "tlg", "20 years", ["\\b(20|twenty) years\\b"]),
      site("F29", "tlg", "over nine years (landscape)", ["\\b(9|nine) years\\b"]),
      site("F30", "tlg", "over 20 years (events)", ["\\b(20|twenty) years\\b"]),
    ],
  }),
  item({
    key: "licensing_insurance",
    title: "Licensing and insurance",
    risk: "high",
    topics: ["insured", "insurance", "licensed", "bonded", "liability"],
    callerQuestion: "Are you licensed and insured?",
    claims: [
      site("F25", "clg", "licensed and bonded", ["\\blicensed\\b", "\\bbonded\\b"]),
      site("F24", "clg", "$1,000,000 liability certificate (2008 file)", ["\\$?1,?000,?000", "\\bmillion\\b"], "We carry a one million dollar liability policy."),
      site("F26", "tlg", "fully licensed and insured", ["\\blicensed\\b", "\\binsured\\b"]),
    ],
  }),
  item({
    key: "business_address",
    title: "Business address",
    risk: "high",
    topics: ["address", "located", "office", "where are you"],
    callerQuestion: "Where are you guys located?",
    claims: [
      site("F05", "clg", "PO Box 90305, Austin 78709", ["\\bp\\.?\\s?o\\.? box\\b", "90305"], "Our address is PO Box 90305, Austin."),
      site("F06", "tlg", "2009 Pyramid Drive, Austin 78734", ["2009 pyramid", "pyramid drive"], "We're at 2009 Pyramid Drive."),
      site("F07", "tlg", "9518 Hwy 290 W, Suite D, Austin 78736", ["\\b9518\\b", "(hwy|highway) 290"], "We're at 9518 Highway 290 West, Suite D."),
    ],
  }),
  item({
    key: "contact_email",
    title: "Email address to give callers",
    risk: "high",
    topics: ["email", "e-mail", "send photos"],
    callerQuestion: "What email can I send pictures of my house to?",
    claims: [
      site("F08", "clg", "guys@thechristmaslightguys.com", ["guys@thechristmaslightguys", "guys at the christmas light guys"]),
      site("F09", "tlg", "thelightguysaustin@gmail.com", ["thelightguysaustin@gmail", "light guys austin at gmail"]),
    ],
  }),
  item({
    key: "permanent_lighting_brand",
    title: "Permanent lighting brand",
    risk: "high",
    topics: ["jellyfish", "inception", "permanent", "brand"],
    callerQuestion: "Are you a JellyFish dealer?",
    claims: [
      site("F37", "tlg", "Authorized JellyFish Lighting dealer", ["jelly ?fish"]),
      {
        brand: "tlg",
        value: "Permanent Inception LED system (2016 architectural page)",
        quote: "Permanent Inception LED Commercial & Home Lighting System",
        sourceUrl: TLG_HOME,
        siteFactId: null,
        spoken: "We install the Permanent Inception LED system.",
        markers: ["\\binception\\b"],
      },
    ],
  }),
  item({
    key: "storage",
    title: "Storage (and whether it is free)",
    risk: "high",
    topics: ["storage", "store", "keep the lights"],
    callerQuestion: "Do you store the lights after the season? Is that free?",
    claims: [site("F17", "clg", "storage, free", ["store (them|the lights|your lights|everything)? ?for free", "free storage", "storage is free"]), site("F17", "tlg", "storage, free", ["store (them|the lights|your lights|everything)? ?for free", "free storage", "storage is free"])],
  }),
  item({
    key: "free_estimate",
    title: "Free estimates",
    risk: "high",
    // Phrases, not the bare word "free": "do you fix storm damage for free?" is not an estimate question.
    topics: ["estimate", "free estimate", "free quote", "consultation"],
    callerQuestion: "Is the estimate free?",
    claims: [site("F18", "clg", "free estimate", ["free estimate", "estimates? (is|are) free", "free consultation"]), site("F18", "tlg", "free estimate", ["free estimate", "estimates? (is|are) free", "free consultation"])],
  }),
  item({
    key: "takedown_dates",
    title: "Takedown dates",
    risk: "high",
    topics: ["take down", "takedown", "removal", "january", "when do you remove"],
    callerQuestion: "When do you come take the lights down?",
    claims: [site("F20", "clg", "starts January 2, most down by January 15", ["january (2|2nd|second|15|15th|fifteenth)\\b", "\\bjan\\.? (2|15)\\b"])],
  }),
  item({
    key: "service_calls",
    title: "Service calls and storm damage",
    risk: "high",
    topics: ["service call", "storm", "repair", "fix", "broken", "went out"],
    callerQuestion: "If a storm knocks the lights down, do you come fix them?",
    claims: [site("F21", "clg", "free service calls; storm-downed lights rehung at no charge", ["free service calls?", "at no charge", "no charge"])],
  }),
  item({
    key: "sister_company",
    title: "The Light Guys as a sister company",
    risk: "low",
    topics: ["light guys", "sister", "same company", "related"],
    callerQuestion: "Are you the same company as The Light Guys?",
    claims: [site("F03", "clg", "The Light Guys is our sister company", ["sister company"])],
  }),
  item({
    key: "other_lighting",
    title: "Permanent, landscape and event lighting",
    risk: "low",
    topics: ["permanent", "landscape", "wedding", "event", "bistro", "year round"],
    callerQuestion: "Do you also do landscape lighting or wedding lights?",
    claims: [
      site("F42", "clg", "event, bistro and landscape lighting (through The Light Guys)", ["landscape lighting", "event lighting", "bistro"]),
      site("F43", "tlg", "event, bistro and landscape lighting (through The Light Guys)", ["landscape lighting", "event lighting", "bistro"]),
    ],
  }),
  item({
    key: "office_hours",
    title: "Office hours",
    risk: "high",
    topics: ["hours", "open", "closed", "what time"],
    callerQuestion: "What are your hours?",
    claims: [site("F48", "tlg", "Monday–Friday 8–5 (search listing data only)", ["\\b8 ?(am|a\\.m\\.)? ?(to|-|–|until) ?5\\b", "monday (through|to|-) friday"], "We're open Monday through Friday, 8 to 5.")],
  }),
  item({
    key: "residential_commercial",
    title: "Homes and businesses",
    risk: "low",
    topics: ["business", "commercial", "residential", "home", "office", "storefront"],
    callerQuestion: "Do you do businesses too, or just homes?",
    claims: [
      site("F11", "clg", "residential and commercial", ["residential and commercial", "homes and businesses"]),
      site("F11", "tlg", "residential and commercial", ["residential and commercial", "homes and businesses"]),
    ],
    suggestedText: "We light both homes and businesses.",
  }),
  item({
    key: "christmas_services",
    title: "What we install",
    risk: "low",
    topics: ["services", "what do you do", "roofline", "trees", "wreath", "garland", "walkway", "design"],
    callerQuestion: "What kind of Christmas lighting do you do?",
    claims: [site("F13", "clg", "roofline, wreaths, garland, trims, trees, hedges, walkways; custom design", []), site("F13", "tlg", "roofline, wreaths, garland, trims, trees, hedges, walkways; custom design", [])],
    suggestedText:
      "We design and install Christmas lights: rooflines, wreaths and garland, door and window trims, trees, hedges and walkways, with a custom design for each property.",
  }),
  item({
    key: "takedown_offered",
    title: "Takedown after the season",
    risk: "low",
    topics: ["take down", "takedown", "removal", "after the season", "after christmas"],
    callerQuestion: "Do you take them down after Christmas too?",
    claims: [
      site("F15", "clg", "taken down at the end of the season", ["take (them|it|everything|the lights) down"]),
      site("F15", "tlg", "taken down at the end of the season", ["take (them|it|everything|the lights) down"]),
    ],
    suggestedText: "We take everything down after the season.",
  }),
  item({
    key: "quote_process",
    title: "How quotes work",
    kind: "policy",
    risk: "low",
    topics: ["price", "cost", "quote", "how much", "estimate", "process"],
    callerQuestion: "How much would it cost to do my roofline?",
    claims: [
      {
        brand: "policy",
        value: "Pricing is handled on the callback",
        quote: "Amy, 2026-10-29: pricing depends on the property and what the customer wants; callers hear \"our team\", not a name.",
        sourceUrl: null,
        siteFactId: null,
        spoken: "Our team handles pricing, because it depends on the property and what you'd like done.",
        markers: [],
      },
    ],
    suggestedText:
      "Our team handles pricing, because it depends on the property and what you'd like done. I'll make sure they have all the details before they call you.",
  }),
  // Amy's requirements of 2026-10-29: how the office works, not claims from either site.
  item({
    key: "we_come_to_you",
    title: "Office visits",
    kind: "policy",
    risk: "low",
    // Bag-of-words matching: "your office", not "office" ("do you light office buildings?").
    topics: ["your office", "stop by", "come in", "showroom", "visit you", "located", "where are you"],
    callerQuestion: "Where's your office? Can I stop by?",
    claims: [
      {
        brand: "policy",
        value: "We come to you; no office visits",
        quote: "Amy, 2026-10-29: appointments, \"we come to you\", no customers at the operating location.",
        sourceUrl: null,
        siteFactId: null,
        spoken: "Feel free to stop by our office.",
        markers: ["stop by (our|the) (office|shop|warehouse)", "come (by|in to) (our|the) (office|shop|warehouse)", "visit (our|the) (office|showroom|shop)"],
      },
    ],
    suggestedText: "Our team can go over everything when they call.",
  }),
  // Amy, 2026-10-29 (evening): a home that's hard to see on Google Maps gets a visit, set up on the callback.
  item({
    key: "site_visit",
    title: "Site visits",
    kind: "policy",
    risk: "low",
    // "visit cost" lets a price question about the visit reach this answer, not the quote process.
    topics: ["site visit", "the visit", "visit cost", "come look", "be home", "be there"],
    callerQuestion: "Is the visit free? Do I need to be home?",
    claims: [
      {
        brand: "policy",
        value: "The visit is free; someone needs to be home",
        quote: "Amy, 2026-10-29: a home not visible on Google Maps needs a site visit; it's free and the homeowner needs to be home.",
        sourceUrl: null,
        siteFactId: null,
        spoken: "The visit is free, and we'll just need someone home for it.",
        markers: ["visit (is|'s) free", "no charge for (the|a) visit"],
      },
    ],
    suggestedText: "The visit is free, and we'll just need someone home for it.",
  }),
  item({
    key: "why_choose_us",
    title: "Why hire us",
    kind: "policy",
    risk: "high",
    topics: ["why should i", "why hire", "myself", "diy", "worth it", "ladder", "what makes you"],
    callerQuestion: "Why should I hire you instead of doing it myself?",
    claims: [
      {
        brand: "policy",
        value: "Amy's themes: white-glove service, gold standard, professional-grade equipment, magical holiday experiences",
        quote: "Amy, 2026-10-29: messaging she likes; exact claims need her words.",
        sourceUrl: null,
        siteFactId: null,
        spoken: "We offer a white-glove, gold-standard service with professional-grade equipment.",
        markers: ["white[- ]glove", "gold[- ]standard", "professional[- ]grade", "commercial[- ]grade", "magical"],
      },
    ],
    suggestedText:
      "We take care of everything: we put your lights up, take them down at the end of the season and store them, so you can spend the holidays with family instead of on a ladder.",
  }),
  item({
    key: "drive_by_checks",
    title: "Drive-by checks during the season",
    kind: "policy",
    risk: "high",
    topics: ["drive by", "check on", "inspect", "inspection", "maintenance", "keep an eye"],
    callerQuestion: "Do you drive by and check on the lights during the season?",
    claims: [
      {
        brand: "policy",
        value: "routine drive-by checks (not a standard service)",
        quote: "Amy, 2026-10-29: routine drive-by inspections are not a standard promised service.",
        sourceUrl: null,
        siteFactId: null,
        spoken: "We drive by and check on your lights during the season.",
        markers: ["drive[- ]?by", "drives? by", "check on (your|the) lights", "(routine|regular|seasonal|weekly) (checks?|inspections?)"],
      },
    ],
  }),
];
