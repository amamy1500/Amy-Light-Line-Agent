import type { KnowledgeItem } from "../model";
import { DURATION, MONEY, ONE_BUSINESS_DAY, RELATIONSHIP, captured, pendingItem, proposed } from "./capture";

/**
 * Sublime Patio's knowledge items, from sublimepatio.com as captured on
 * 2026-10-22 (12 sitemap pages; register SP01–SP66 in
 * docs/research/sublime-fridge-knowledge.md). All items start pending.
 */

const SP = "https://sublimepatio.com";
const HOME = `${SP}/`;
const ABOUT = `${SP}/about-us/`;
const CONTACT = `${SP}/contact-us/`;
const KITCHENS = `${SP}/outdoor-kitchens/`;
const PERGOLAS = `${SP}/pergolas-covered-patios/`;
const STONE = `${SP}/stone-gravel-pathways/`;
const PATIOS = `${SP}/patios-masonry-decking/`;
const LIGHTING = `${SP}/landscape-patio-lighting/`;
const LOUVERED = `${SP}/louvered-shade-systems/`;
const LANDSCAPING = `${SP}/landscaping/`;
const TURF = `${SP}/artificial-turf-golf-greens/`;

const AREA_EXTRA_CITIES = [
  "\\bleander\\b",
  "\\bwestlake\\b",
  "\\brollingwood\\b",
  "\\bspicewood\\b",
  "\\bbuda\\b",
  "\\bkyle\\b",
  "\\bbastrop\\b",
  "\\bjonestown\\b",
];

export const SUBLIME_KNOWLEDGE: KnowledgeItem[] = [
  pendingItem({
    key: "sp_services",
    title: "What Sublime builds",
    risk: "low",
    topics: ["services", "what do you do", "kitchen", "pergola", "patio", "deck", "turf", "putting green", "louvered", "landscaping"],
    callerQuestion: "What kind of work do you guys do?",
    claims: [
      captured("SP26", "sp", "8 outdoor-living services", "Outdoor Kitchens · Pergolas & Covered Patios · Stone & Gravel Pathways · Patios, Masonry & Decking · Landscape & Patio Lighting · Louvered Shade Systems · Landscaping · Artificial Turf & Golf Greens", HOME, []),
      captured("SP28", "sp", "8 outdoor-living services", "Every single project we take on is fully custom-built.", HOME, []),
    ],
    suggestedText:
      "Sublime Patio designs and builds outdoor living spaces: outdoor kitchens, pergolas and covered patios, patios, masonry and decks, stone and gravel paths, landscape lighting, louvered shade systems, landscaping, and artificial turf and putting greens. Every project is custom.",
  }),
  pendingItem({
    key: "sp_service_area",
    title: "Service area",
    kind: "service_area",
    risk: "high",
    topics: ["service area", "come out", "serve", "area", "location", "far"],
    callerQuestion: "Do you guys do projects out in Dripping Springs?",
    claims: [
      captured("SP61", "sp", "15 cities (Contact page)", "Austin · Round Rock · Pflugerville · Georgetown · Leander · Westlake Hills · Lakeway · Bee Cave · Rollingwood · Spicewood · Cedar Park · Buda · Kyle · Bastrop · Jonestown", CONTACT, AREA_EXTRA_CITIES),
      captured("SP62", "sp", "Austin, Round Rock, Cedar Park, Georgetown + Central Texas", "We serve homeowners across Austin, Round Rock, Cedar Park, Georgetown, and the broader Central Texas region.", ABOUT, ["central texas"]),
      captured("SP63", "sp", "7 cities + 'we likely do'", "Not sure if we cover your area? Give us a call — we likely do.", ABOUT, ["we (likely|probably) (do|serve|cover)", "\\blakeway\\b", "bee cave"]),
      captured("SP64", "sp", "Austin, Round Rock, Cedar Park, Georgetown + surrounding", "Serving Austin, Round Rock, Cedar Park, Georgetown & surrounding areas", KITCHENS, ["surrounding areas"]),
      captured("SP65", "sp", "Austin + Texas Hill Country (turf)", "homeowners across Austin and the Texas Hill Country", TURF, ["hill country"]),
    ],
  }),
  pendingItem({
    key: "sp_years_in_business",
    title: "Business history",
    risk: "high",
    topics: ["how long", "years", "experience", "in business", "history", "founded"],
    callerQuestion: "How long has Sublime been around?",
    claims: [
      captured("SP13", "sp", "since 2002", "Austin’s trusted outdoor living contractor since 2002.", HOME, ["\\b2002\\b", "two thousand (and )?two"]),
      captured("SP14", "sp", "20+ years", "20+ Years Experience", HOME, ["\\b(20|twenty)\\+? years\\b", "over (20|twenty) years"]),
      captured("SP15", "sp", "23+ years (counter)", "Years in Business 23+", HOME, ["\\b(23|twenty[- ]three)\\+? years\\b"]),
      captured("SP16", "sp", "over 15 years", "for over 15 years", ABOUT, ["\\b(15|fifteen) years\\b"]),
    ],
  }),
  pendingItem({
    key: "sp_founder",
    title: "Owner and founder (and whether to name him)",
    risk: "high",
    topics: ["owner", "founder", "josh", "joshua", "bailey", "who runs", "speak to"],
    callerQuestion: "Is Josh the owner? Can I talk to him?",
    claims: [
      captured("SP12", "sp", "founded by Joshua Bailey", "Sublime Patio & Outdoor Living was founded in 2002 by Joshua Bailey.", HOME, ["joshua bailey", "\\bbailey\\b", "founded (it|the company)"]),
      captured("SP18", "sp", "founded by Joshua Bailey", "His extensive experience in the industry, including landscaping, patio design, deck construction & outdoor lighting", HOME, []),
    ],
  }),
  pendingItem({
    key: "sp_licensing_insurance",
    title: "Licensing and insurance",
    risk: "high",
    topics: ["licensed", "license", "insured", "insurance", "bonded", "electrician"],
    callerQuestion: "Are you licensed and insured?",
    claims: [
      captured("SP24", "sp", "licensed and insured; scope unstated", "Sublime Patio is a fully licensed and insured outdoor living contractor.", HOME, ["\\blicensed\\b", "\\binsured\\b"]),
      captured("SP25", "sp", "licensed and insured; scope unstated", "A licensed electrician handles all wiring", PERGOLAS, ["licensed electrician"]),
    ],
  }),
  pendingItem({
    key: "sp_free_estimate",
    title: "Free estimates and consultations",
    risk: "high",
    topics: ["estimate", "consultation", "free", "come look", "site visit", "quote"],
    callerQuestion: "Is the estimate free?",
    claims: [
      captured("SP53", "sp", "free on-site estimate, no obligation", "Free Estimates Available", HOME, ["free (estimate|consultation|quote|design consultation)s?", "estimates? (is|are) free", "no[- ]obligation", "complimentary"]),
      captured("SP53", "sp", "free on-site estimate, no obligation", "complimentary on-site design consultations for all prospective clients", ABOUT, ["complimentary"]),
    ],
  }),
  pendingItem({
    key: "sp_quote_process",
    title: "How pricing works",
    kind: "policy",
    risk: "low",
    topics: ["price", "cost", "how much", "quote", "estimate", "ballpark"],
    callerQuestion: "Roughly how much would a covered patio run?",
    claims: [
      captured("SP49", "sp", "every project priced individually", "Every patio and masonry project is priced individually", PATIOS, []),
      captured("SP49", "sp", "every project priced individually", "Every flagstone walkway Austin project is priced individually", STONE, []),
    ],
    suggestedText:
      "Every project is priced individually, so the team needs to learn about your property and what you'd like built before giving a number. I can have them call you to set that up.",
  }),
  pendingItem({
    key: "sp_price_ranges",
    title: "Published price ranges and resale claims",
    risk: "high",
    topics: ["price", "cost", "how much", "range", "budget", "resale", "value", "worth it"],
    callerQuestion: "What's a typical outdoor kitchen cost with you?",
    claims: [
      // One shared value: the pages do not disagree, they publish figures Amy has not approved.
      captured("SP47", "sp", "published price figures", "typically range from $10,000 to $60,000+", KITCHENS, MONEY),
      captured("SP48", "sp", "published price figures", "typically costs between $6,000 and $35,000", PERGOLAS, MONEY),
      captured("SP49", "sp", "published price figures", "range from a few thousand dollars for smaller paver installations", PATIOS, MONEY),
      captured("SP50", "sp", "published price figures", "increase a home’s resale value by $15,000–$50,000 or more", KITCHENS, [...MONEY, "resale value", "\\bROI\\b"]),
      captured("SP51", "sp", "published price figures", "Transparent pricing no hidden costs", HOME, ["hidden (costs|fees)", "transparent pricing"]),
    ],
    // Recommendation for Amy: reject. The agent never states a range (docs/amy-open-questions.md Q8).
  }),
  pendingItem({
    key: "sp_financing",
    title: "Financing",
    risk: "high",
    topics: ["financing", "finance", "payment plan", "monthly", "loan", "pay over time"],
    callerQuestion: "Do you offer financing?",
    claims: [
      captured("SP54", "sp", "financing discussed at consultation", "we can discuss financing options during your free consultation", KITCHENS, ["financ(e|ing)", "payment plans?", "pay (it )?over time"]),
    ],
  }),
  pendingItem({
    key: "sp_warranty",
    title: "Warranties and guarantees",
    risk: "high",
    topics: ["warranty", "guarantee", "covered", "if it breaks", "workmanship"],
    callerQuestion: "What kind of warranty comes with a louvered roof?",
    claims: [
      captured("SP55", "sp", "warranty or guarantee claimed; terms unpublished", "backed by manufacturer warranties, and our installation work is covered by our own workmanship guarantee", LOUVERED, ["warrant(y|ies|ied)", "workmanship", "guarantee"]),
      captured("SP56", "sp", "warranty or guarantee claimed; terms unpublished", "backed by a manufacturer’s product warranty covering material defects, along with our own workmanship guarantee", TURF, ["warrant(y|ies|ied)", "workmanship", "guarantee"]),
      captured("SP57", "sp", "warranty or guarantee claimed; terms unpublished", "Ask your design consultant about specific plant warranty or replacement terms", LANDSCAPING, ["plant (warranty|replacement)"]),
      captured("SP22", "sp", "warranty or guarantee claimed; terms unpublished", "Quality Guaranteed", HOME, ["quality guaranteed", "satisfaction", "stand behind"]),
    ],
  }),
  pendingItem({
    key: "sp_project_duration",
    title: "How long a build takes (and how soon it can start)",
    risk: "high",
    topics: ["how long", "timeline", "weeks", "days", "start", "schedule", "backlog", "how soon"],
    callerQuestion: "How long would a pergola take, and when could you start?",
    claims: [
      captured("SP58", "sp", "per-service build durations (site FAQs)", "between 2 and 6 weeks from build start", KITCHENS, DURATION),
      captured("SP58", "sp", "per-service build durations (site FAQs)", "between 1 and 4 weeks", PERGOLAS, DURATION),
      captured("SP58", "sp", "per-service build durations (site FAQs)", "Most louvered shade system installations take 3 to 7 days", LOUVERED, DURATION),
      captured("SP58", "sp", "per-service build durations (site FAQs)", "Most residential installations are completed within 2 to 5 days", TURF, DURATION),
    ],
  }),
  pendingItem({
    key: "sp_process",
    title: "How a project works",
    risk: "low",
    topics: ["process", "how does it work", "steps", "design", "first step", "what happens next"],
    callerQuestion: "What's the process if I want to get started?",
    claims: [
      captured("SP59", "sp", "consultation, design, permits, build, walkthrough", "Free Consultation → Custom Design → Planning & Permits → Expert Construction → Final Walkthrough", ABOUT, []),
      captured("SP60", "sp", "consultation, design, permits, build, walkthrough", "We visit your property, listen carefully, and assess the space with expert eyes.", ABOUT, []),
    ],
    // Suggested text deliberately omits "free", "3D" and permits; those stay with their own high-risk items.
    suggestedText:
      "It starts with a visit to your property to see the space and hear what you want. The team then designs it, plans the build, builds it, and walks the finished space with you.",
  }),
  pendingItem({
    key: "sp_design_renderings",
    title: "3D designs before the build",
    risk: "high",
    topics: ["3d", "rendering", "drawing", "design", "see it first", "plans"],
    callerQuestion: "Will I get to see a 3D drawing before you build it?",
    claims: [
      captured("SP29", "sp", "in-house 3D plans and renderings", "Our in-house design team creates detailed 3D renderings", ABOUT, ["\\b3[- ]?d\\b", "render(ing|ings)"]),
      captured("SP29", "sp", "in-house 3D plans and renderings", "Our team creates detailed 3D plans and material selections", ABOUT, ["\\b3[- ]?d\\b"]),
    ],
  }),
  pendingItem({
    key: "sp_permits_hoa",
    title: "Permits and HOA approval",
    risk: "high",
    topics: ["permit", "city", "hoa", "inspection", "approval", "engineering"],
    callerQuestion: "Do you handle the permit and my HOA?",
    claims: [
      captured("SP30", "sp", "handles permits, inspections and approvals", "All permits pulled and inspections handled", PERGOLAS, ["permits? (pulled|handled)", "we (pull|handle) (the |all )?permits?"]),
      captured("SP31", "sp", "handles permits, inspections and approvals", "Sublime Patio handles the structural planning and necessary engineering blueprints", PATIOS, ["\\bhoa\\b", "engineering blueprints"]),
    ],
  }),
  pendingItem({
    key: "sp_response_time",
    title: "How fast the team calls back",
    risk: "high",
    topics: ["call back", "hear back", "how soon", "respond", "when will"],
    callerQuestion: "When will someone call me back?",
    claims: [
      captured("SP07", "sp", "within one business day", "Josh or a member of the Sublime team will reach out within one business day to schedule your on-site consultation.", HOME, ONE_BUSINESS_DAY),
      captured("SP06", "sp", "within one business day", "We respond within one business day", CONTACT, ONE_BUSINESS_DAY),
    ],
  }),
  pendingItem({
    key: "sp_texting",
    title: "Can callers text this number",
    risk: "high",
    topics: ["text", "sms", "send photos", "message"],
    callerQuestion: "Can I just text you some pictures of my backyard?",
    claims: [captured("SP04", "sp", "call or text the shared line", "Call or Text (512) 339-9313 Fastest way to reach us", CONTACT, ["call or text", "text (us|me|this number|it)", "(send|shoot) (us|me) a text"])],
  }),
  pendingItem({
    key: "sp_contact_email",
    title: "Email address to give callers",
    risk: "high",
    topics: ["email", "e-mail", "send photos", "send plans"],
    callerQuestion: "What email can I send my HOA plans to?",
    claims: [captured("SP05", "sp", "sublimepatio@gmail.com", "sublimepatio@gmail.com", CONTACT, ["sublimepatio@gmail", "sublime ?patio at gmail"])],
  }),
  pendingItem({
    key: "sp_address",
    title: "Address (shared PO Box)",
    risk: "high",
    topics: ["address", "located", "office", "showroom", "where are you", "come by"],
    callerQuestion: "What's your mailing address?",
    claims: [captured("SP08", "sp", "PO Box 90305, Austin 78709 (shared with CLG/TLG)", "PO Box 90305 Austin, Texas 78709", CONTACT, ["\\bp\\.?\\s?o\\.? box\\b", "90305"])],
  }),
  pendingItem({
    key: "sp_site_visits",
    title: "Meetings happen at the property",
    risk: "low",
    topics: ["showroom", "office", "come by", "visit you", "meet", "stop in"],
    callerQuestion: "Do you have a showroom I can visit?",
    claims: [captured("SP09", "sp", "by appointment at the customer's property", "By appointment we come to you", CONTACT, [])],
    suggestedText: "We meet you at your property, by appointment.",
  }),
  pendingItem({
    key: "sp_holiday_lighting",
    title: "Holiday lighting (Sublime vs The Christmas Light Guys)",
    risk: "high",
    topics: ["christmas", "holiday", "seasonal", "string lights", "event lights"],
    callerQuestion: "Can you put up Christmas lights when you do my patio lighting?",
    claims: [
      captured("SP40", "sp", "Sublime: yes, seasonal accent lighting", "many of our clients pair their permanent architectural lighting system with seasonal accent lighting for holidays or special events", LIGHTING, ["holiday lighting", "seasonal (accent )?light(ing|s)", "christmas lights?"]),
      captured("F12", "clg", "CLG: Christmas light installation", "Our professional Christmas light installation and decorating service", "https://thechristmaslightguys.com/", []),
    ],
  }),
  pendingItem({
    key: "sp_landscape_lighting_routing",
    title: "Landscape lighting (Sublime vs The Light Guys)",
    risk: "high",
    topics: ["landscape lighting", "patio lighting", "uplighting", "path lights", "outdoor lights"],
    callerQuestion: "I want lights along my walkway and up into the oak trees. Is that you?",
    claims: [
      captured("SP38", "sp", "Sublime: low-voltage landscape lighting", "custom, low-voltage architectural LED installations", LIGHTING, []),
      captured("F47", "tlg", "The Light Guys: landscape lighting", "BISTRO POOL AND LANDSCAPE LIGHTING", "https://thelightguysaustintx.com/landscape-lighting/", []),
    ],
  }),
  pendingItem({
    key: "sp_maintenance",
    title: "Ongoing maintenance",
    risk: "low",
    topics: ["maintenance", "mow", "upkeep", "lawn care", "ongoing"],
    callerQuestion: "Do you do ongoing yard maintenance after?",
    claims: [captured("SP44", "sp", "design and installation focus; no ongoing maintenance", "Our primary focus is design and installation", LANDSCAPING, [])],
    suggestedText: "Our focus is design and installation. For ongoing yard maintenance, most clients use a local maintenance company.",
  }),
  pendingItem({
    key: "sp_residential_commercial",
    title: "Homes only, or commercial too",
    risk: "high",
    topics: ["commercial", "business", "restaurant", "hoa common area", "builder", "apartment"],
    callerQuestion: "Do you do commercial patios, like for a restaurant?",
    claims: [captured("SP27", "sp", "homeowners (no commercial claim)", "Trusted By Austin Homeowners", HOME, [])],
  }),
  pendingItem({
    key: "sp_product_brands",
    title: "Product brands",
    risk: "high",
    topics: ["brand", "trex", "timbertech", "manufacturer", "what kind of", "louver brand", "turf brand"],
    callerQuestion: "Do you install Trex decking?",
    claims: [captured("SP37", "sp", "Trex/TimberTech named as examples only", "Composite decking (like Trex or TimberTech)", PATIOS, ["\\btrex\\b", "timber ?tech", "(authorized|certified) (dealer|installer)"])],
  }),
  pendingItem({
    key: "sp_reputation",
    title: "Reviews, volume and superlatives",
    risk: "high",
    topics: ["reviews", "rating", "references", "how many", "best", "trusted"],
    callerQuestion: "How many of these have you done? Do you have reviews?",
    claims: [
      captured("SP19", "sp", "published reputation claims", "500+ Happy Clients", HOME, ["\\b500\\b", "five hundred", "hundreds of"]),
      captured("SP20", "sp", "published reputation claims", "5-Star Reviews", HOME, ["\\b(5|five)[- ]star\\b"]),
      captured("SP21", "sp", "published reputation claims", "the region’s most trusted outdoor living specialist", ABOUT, ["most trusted", "\\bpremier\\b", "\\bbest in\\b"]),
      captured("SP23", "sp", "published reputation claims", "I have been very impressed with Sublime Patio from the initial meeting with Josh.", HOME, ["\\bkaren\\b", "\\bandy\\b", "\\bjuan\\b"]),
    ],
  }),
  pendingItem({
    key: "sp_product_performance",
    title: "Product performance numbers",
    risk: "high",
    topics: ["wind", "waterproof", "how long does it last", "lifespan", "energy", "safe", "pets", "kids", "drain"],
    callerQuestion: "Will a louvered roof hold up in a big storm?",
    claims: [
      captured("SP42", "sp", "published performance figures", "wind loads up to 110+ mph", LOUVERED, ["\\b110\\b", "\\bmph\\b", "waterproof"]),
      captured("SP39", "sp", "published performance figures", "consume up to 80% less energy than old halogen bulbs", LIGHTING, ["\\b80 ?%", "\\b(40|50),?000 hours", "zero risk", "18 years"]),
      captured("SP46", "sp", "published performance figures", "last 15 to 20+ years", TURF, ["(15|fifteen) to (20|twenty)", "inches per hour", "non-?toxic", "lead[- ]free|free of lead"]),
    ],
  }),
  pendingItem({
    key: "sp_office_hours",
    title: "Office hours",
    risk: "high",
    topics: ["hours", "open", "closed", "what time", "weekend", "saturday"],
    callerQuestion: "What are your hours?",
    claims: [],
  }),
  pendingItem({
    key: "sp_sister_brands",
    title: "Relationship to the other companies on this line",
    risk: "high",
    topics: ["light guys", "christmas light guys", "the fridge", "same company", "related", "sister"],
    callerQuestion: "Wait, is this the same company as The Light Guys?",
    claims: [proposed("no site states a relationship", "Sublime Patio is part of the same family of companies as The Light Guys.", RELATIONSHIP)],
  }),
];
