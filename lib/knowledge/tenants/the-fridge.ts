import type { KnowledgeItem } from "../model";
import { ONE_BUSINESS_DAY, RELATIONSHIP, captured, pendingItem, proposed } from "./capture";

/**
 * The Fridge Vending's knowledge items, from thefridgevending.com as captured
 * on 2026-10-22 (one-page React site; register TF01–TF25 in
 * docs/research/sublime-fridge-knowledge.md). All items start pending.
 */

const TF = "https://thefridgevending.com/";

export const FRIDGE_KNOWLEDGE: KnowledgeItem[] = [
  pendingItem({
    key: "tf_what_we_do",
    title: "What The Fridge is",
    risk: "low",
    topics: ["what is", "what do you do", "vending", "machine", "fridge", "smart"],
    callerQuestion: "What exactly is The Fridge?",
    claims: [
      captured("TF06", "tf", "smart vending machines in local businesses", "The Fridge uses modern smart-vending technology", TF, ["\\bai\\b", "a\\.i\\.", "artificial intelligence"]),
      captured("TF11", "tf", "smart vending machines in local businesses", "Ideal for repair shops, tire shops, service centers, and dealerships with waiting rooms.", TF, []),
    ],
    // Omits "AI" and "free"; both stay forbidden until Amy approves them.
    suggestedText:
      "The Fridge places smart vending machines in local businesses, like auto shop waiting rooms, apartment communities and employee break rooms, stocked around what the people there want.",
  }),
  pendingItem({
    key: "tf_placement_cost",
    title: "Cost to host a machine",
    risk: "high",
    topics: ["cost", "free", "how much", "price", "charge", "fee", "pay"],
    callerQuestion: "Does it cost me anything to have one?",
    claims: [
      captured("TF07", "tf", "free to host, $0", "The machine is placed at no charge", TF, ["free placement", "no (cost|charge)", "\\$0\\b", "zero (dollars|cost)", "costs? (you )?nothing", "free of charge", "(placement|install(ation)?|delivery) is free"]),
    ],
  }),
  pendingItem({
    key: "tf_contract_terms",
    title: "Contract, obligation and removal",
    risk: "high",
    topics: ["contract", "obligation", "commitment", "cancel", "remove", "sign", "term"],
    callerQuestion: "Do I have to sign a contract?",
    claims: [captured("TF09", "tf", "no obligation", "Free placement · No obligation · We reply within one business day.", TF, ["no[- ]obligation", "no contract", "cancel any ?time"])],
  }),
  pendingItem({
    key: "tf_host_workload",
    title: "Who delivers, stocks and services the machine",
    risk: "high",
    topics: ["restock", "who stocks", "maintain", "service", "install", "delivery", "work for us"],
    callerQuestion: "Who keeps it stocked? Do my people have to do anything?",
    claims: [
      captured("TF08", "tf", "delivered, installed, stocked and serviced by The Fridge", "Delivered, installed, stocked & serviced.", TF, ["stocked (and|&) serviced", "we (stock|restock|service|maintain)", "no (extra )?work"]),
      captured("TF08", "tf", "delivered, installed, stocked and serviced by The Fridge", "Bring a modern convenience amenity into your space without buying or maintaining a machine.", TF, ["without (buying|maintaining)"]),
    ],
  }),
  pendingItem({
    key: "tf_location_fit",
    title: "Which locations it is for",
    risk: "low",
    topics: ["auto shop", "tire shop", "dealership", "apartment", "office", "break room", "gym", "my business", "good fit"],
    callerQuestion: "Would this work in my tire shop?",
    claims: [
      captured("TF12", "tf", "auto/tire shops, dealerships, apartments, offices, gyms, high-traffic", "Auto repair shop · Tire shop / service center · Car dealership · Apartment community · Office / employee break room · Gym / fitness center · Other high-traffic location", TF, []),
      captured("TF11", "tf", "auto/tire shops, dealerships, apartments, offices, gyms, high-traffic", "Break rooms · Warehouses & shops · Offices & studios · High-traffic staff areas", TF, []),
    ],
    suggestedText:
      "The Fridge is designed for auto repair and tire shops, dealerships, apartment communities, offices and break rooms, gyms, and other busy locations. The team can tell you whether your space is a good fit.",
  }),
  pendingItem({
    key: "tf_products",
    title: "What goes in the machine",
    risk: "low",
    topics: ["stock", "products", "snacks", "drinks", "lunch", "healthy", "energy drinks", "toys"],
    callerQuestion: "What kind of stuff do you put in it?",
    claims: [
      captured("TF13", "tf", "drinks, snacks, protein, lunch items, candy, kids' toys and puzzles", "Energy drinks, bottled water, sparkling water, sodas, teas, juices, and sports drinks", TF, []),
      captured("TF15", "tf", "drinks, snacks, protein, lunch items, candy, kids' toys and puzzles", "The selection is built around your space", TF, []),
    ],
    suggestedText:
      "It can carry cold drinks and energy drinks, healthy snacks, protein bars, lunch items like sandwiches and salads, chips and candy, and small toys and puzzles for kids. The mix is built around your location.",
  }),
  pendingItem({
    key: "tf_custom_requests",
    title: "Stocking special requests",
    risk: "high",
    topics: ["can you stock", "special request", "my brand", "specific item", "change the mix"],
    callerQuestion: "Can you stock a specific energy drink my guys like?",
    claims: [
      captured("TF14", "tf", "stocks whatever the location wants", "If your people want it, we can stock it.", TF, ["we can stock (it|that|anything)", "anything (you|they) want", "adjust(ed)? any ?time"]),
      captured("TF15", "tf", "stocks whatever the location wants", "100% Customized to you", TF, ["100 ?%|one hundred percent", "fully customi[sz]ed"]),
    ],
  }),
  pendingItem({
    key: "tf_service_area",
    title: "Where The Fridge places machines",
    kind: "service_area",
    risk: "high",
    topics: ["area", "where", "serve", "location", "city", "how far"],
    callerQuestion: "Do you place machines in San Marcos?",
    claims: [captured("TF21", "tf", "'local businesses' (no area stated)", "AI smart vending machines placed in local businesses at no charge", TF, ["\\baustin\\b", "central texas", "round rock"])],
  }),
  pendingItem({
    key: "tf_phone_number",
    title: "Phone number for The Fridge",
    risk: "high",
    topics: ["phone", "number", "call", "reach"],
    callerQuestion: "What's the best number to reach The Fridge?",
    claims: [
      captured("TF02", "tf", "512-923-9313", "512-923-9313", TF, ["923[- .]?9313", "nine two three"]),
      captured("SP03", "sp", "512-339-9313 (shared line)", "(512) 339-9313 - Free Estimates Available", "https://sublimepatio.com/", ["339[- .]?9313", "three three nine"]),
    ],
  }),
  pendingItem({
    key: "tf_contact_person",
    title: "Contact person (and whether to name him)",
    risk: "high",
    topics: ["owner", "president", "joshua", "josh", "bailey", "who do i talk to", "manager"],
    callerQuestion: "Is Joshua there? The website says to call him.",
    claims: [captured("TF03", "tf", "Joshua Bailey, President", "Call Joshua Bailey, President", TF, ["joshua bailey", "\\bbailey\\b", "\\bpresident\\b"])],
  }),
  pendingItem({
    key: "tf_contact_email",
    title: "Email address to give callers",
    risk: "high",
    topics: ["email", "e-mail", "write", "send"],
    callerQuestion: "Can I email you the details instead?",
    claims: [captured("TF04", "tf", "hello@thefridgevending.com (hidden mailto target)", "hello@thefridgevending.com", TF, ["hello@thefridgevending", "hello at the ?fridge ?vending"])],
  }),
  pendingItem({
    key: "tf_response_time",
    title: "How fast the team replies",
    risk: "high",
    topics: ["call back", "hear back", "respond", "how soon", "when"],
    callerQuestion: "How soon will someone get back to me?",
    claims: [captured("TF10", "tf", "within one business day", "We reply within one business day.", TF, ONE_BUSINESS_DAY)],
  }),
  pendingItem({
    key: "tf_machine_hours",
    title: "When the machine can be used",
    risk: "high",
    topics: ["24/7", "always open", "after hours", "night", "weekend", "anytime"],
    callerQuestion: "Can my tenants use it at night?",
    claims: [captured("TF16", "tf", "open 24/7", "24/7 Always open", TF, ["24 ?/ ?7", "twenty[- ]four seven", "always open", "around the clock"])],
  }),
  pendingItem({
    key: "tf_payment",
    title: "How people pay at the machine",
    risk: "high",
    topics: ["pay", "card", "cash", "coins", "apple pay", "checkout", "tap"],
    callerQuestion: "Does it take cash, or just cards?",
    claims: [
      captured("TF17", "tf", "tap checkout, no coins", "Tap. Grab. Gone in sixty seconds.", TF, ["(60|sixty) seconds", "tap (to|and) (pay|go|open)"]),
      captured("TF18", "tf", "tap checkout, no coins", "No clunky old machine, no attendant, no coins.", TF, ["no coins", "no cash", "cards? only"]),
    ],
  }),
  pendingItem({
    key: "tf_machine_issue",
    title: "A machine is down, empty or not cooling",
    kind: "policy",
    risk: "low",
    topics: ["broken", "not working", "empty", "out of", "restock", "not cold", "screen", "door", "error"],
    callerQuestion: "The machine in our break room isn't cold. Who fixes that?",
    claims: [proposed("take the details; the team follows up", "I'm sorry about that. Let me take down where the machine is and what's happening, and I'll pass it to the team.")],
    suggestedText:
      "I'm sorry about that. Let me take down where the machine is and what's happening, and I'll pass it to the team.",
  }),
  pendingItem({
    key: "tf_refunds",
    title: "Charged but nothing came out",
    kind: "policy",
    risk: "high",
    topics: ["refund", "charged", "took my money", "didn't open", "double charged", "money back"],
    callerQuestion: "It charged my card and the door never opened. Can I get my money back?",
    // The wording avoids "refund" on purpose: an approved text unblocks every marker it contains.
    claims: [proposed("agent never promises a refund", "I can't fix a charge myself, but I'll take the details so the team can look into it.", ["refund(ed)?", "money back", "credit (your|the) card", "reimburse"])],
    suggestedText: "I can't fix a charge myself, but I'll take the details so the team can look into it.",
  }),
  pendingItem({
    key: "tf_host_revenue",
    title: "What the host earns (commission, revenue share)",
    kind: "policy",
    risk: "high",
    topics: ["commission", "revenue", "profit", "cut", "split", "what do i get", "percentage"],
    callerQuestion: "Do I get a cut of the sales?",
    claims: [proposed("not on the site; never discussed by the agent", "The team will go over how it works for your location when they call you back.", ["commission", "revenue[- ]share", "\\bprofit\\b", "\\bsplit\\b", "percent(age)?", "\\bcut\\b of"])],
    suggestedText: "The team will go over how it works for your location when they call you back.",
  }),
  pendingItem({
    key: "tf_placement_process",
    title: "How a placement works",
    risk: "low",
    topics: ["process", "how does it work", "next steps", "get started", "sign up"],
    callerQuestion: "What happens if I want one?",
    claims: [captured("TF19", "tf", "learn the location, build the mix, place the machine", "Tell us about your location → We customize the product mix → The machine is placed at no charge → People grab what they want", TF, [])],
    // Omits "no charge"; that stays with tf.placement_cost.
    suggestedText:
      "It starts with a conversation about your location: your customers, your staff and how busy it gets. The team then builds a product mix for your space and arranges the placement.",
  }),
  pendingItem({
    key: "tf_track_record",
    title: "Existing placements and experience",
    risk: "high",
    topics: ["how many", "where else", "references", "how long", "experience", "new company"],
    callerQuestion: "Where else do you have these machines?",
    claims: [captured("TF20", "tf", "a live placement exists (photo caption)", "An employee break room, stocked and ready.", TF, ["live placement", "(already|currently) (in|at) \\d+", "(machines|locations) (around|across|all over)"])],
  }),
  pendingItem({
    key: "tf_web_form",
    title: "Caller says they already sent the online form",
    kind: "policy",
    risk: "low",
    topics: ["form", "website", "sent a request", "filled out", "already applied"],
    callerQuestion: "I filled out the form on your website last week.",
    claims: [captured("TF24", "tf", "form only opens an email draft", "Your email app should have opened with the details filled in.", TF, [])],
    suggestedText: "Thanks for reaching out. So nothing gets missed, let me take your details again.",
  }),
  pendingItem({
    key: "tf_office_hours",
    title: "Office hours (not machine hours)",
    risk: "high",
    topics: ["hours", "open", "office", "what time", "closed"],
    callerQuestion: "What are your office hours?",
    claims: [],
  }),
  pendingItem({
    key: "tf_sister_brands",
    title: "Relationship to the other companies on this line",
    risk: "high",
    topics: ["sublime", "light guys", "christmas light guys", "same company", "related", "josh"],
    callerQuestion: "Is this the same Josh who did my patio?",
    claims: [proposed("no site states a relationship", "The Fridge is part of the same family of companies as Sublime Patio.", RELATIONSHIP)],
  }),
];
