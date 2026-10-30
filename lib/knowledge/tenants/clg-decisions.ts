import type { OwnerDecision } from "../model";

/**
 * Amy's own answers, by email on 2026-10-22 (entered by Pavan), her
 * requirements of 2026-10-29 and her texts that evening approving the exact
 * words (relayed by Pavan), applied through the same audited decision path as
 * /approvals. Her words are kept as she wrote them where the assistant speaks
 * them. Items she didn't answer stay pending, and the assistant keeps
 * deferring to the callback on them.
 */
export const CLG_DECIDED_BY = "Amy (email 2026-10-22, entered by Pavan)";
export const CLG_DECIDED_BY_1029 = "Amy (requirements 2026-10-29, relayed by Pavan)";
export const CLG_DECIDED_BY_1029_EVENING = "Amy (texts 2026-10-29 evening, relayed by Pavan)";

/** TLG site list; Amy: "The 18 areas. Some are not cities." */
const SERVICE_AREAS = [
  "Austin", "Round Rock", "Pflugerville", "Georgetown", "Leander", "Westlake Hills", "Lakeway", "Bee Cave",
  "Rollingwood", "Spicewood", "Cedar Park", "Buda", "Kyle", "Bastrop", "Jonestown", "Lago Vista", "Volente",
  "Dripping Springs",
];

export const CLG_AMY_DECISIONS: readonly OwnerDecision[] = [
  {
    // The answer to "how much?". Callers hear "our team", not a name: Amy calls back herself
    // and doesn't want to be stuck wearing that hat (texts, 2026-10-29 evening).
    key: "quote_process",
    status: "approved",
    text: "Our team handles pricing, because it depends on the property and what you'd like done. I'll make sure they have all the details before they call you.",
    by: CLG_DECIDED_BY_1029_EVENING,
    replaces: "Josh handles the pricing because it depends on the property and what you'd like done. I can make sure he has the details before he calls you.",
  },
  { key: "years_in_business", status: "approved", text: "We've been in business for 20 years." }, // Q9
  { key: "service_area", status: "approved", value: { cities: SERVICE_AREAS, zips: [] } }, // Q10
  // Q11: "No (we do have insurance, but they almost never ask, so not necessary)": never said.
  { key: "licensing_insurance", status: "rejected" },
  { key: "free_estimate", status: "approved", text: "Yes, estimates are free." }, // Q12
  {
    // Q12: "It is included in the service." Not "free": that word stays unsaid.
    key: "storage",
    status: "approved",
    text: "Storage is included in the service. We put your lights up, take them down at the end of the season, and store them for you.",
  },
  {
    key: "takedown_offered",
    status: "approved",
    text: "Yes, we take everything down at the end of the season, and storage is included.",
  },
  { key: "takedown_dates", status: "approved", text: "We start taking lights down on January 2nd and finish by mid-January." }, // Q13
  {
    // Q14: no permanent lighting now; neither site's brand claim is said.
    key: "permanent_lighting_brand",
    status: "approved",
    text: "We're not installing permanent lighting right now. We'll start offering it in February.",
  },
  // Q15 approved the Gmail address; on 10-29 she asked not to give out email because of spam.
  { key: "contact_email", status: "rejected", by: CLG_DECIDED_BY_1029 },
  // No customers at the operating location, and no address is ever given.
  { key: "business_address", status: "rejected", by: CLG_DECIDED_BY_1029 },
  {
    // "No need to mention office visits. No one asks." She kept the second half (2026-10-29 evening).
    key: "we_come_to_you",
    status: "approved",
    text: "Our team can go over everything when they call.",
    by: CLG_DECIDED_BY_1029_EVENING,
    replaces: "We come to you, so there's no office to visit. Josh can go over everything when he calls.",
  },
  { key: "site_visit", status: "approved", text: "The visit is free, and we'll just need someone home for it.", by: CLG_DECIDED_BY_1029_EVENING },
  { key: "office_hours", status: "approved", text: "We return calls Monday through Friday, nine to five.", by: CLG_DECIDED_BY_1029_EVENING },
  {
    // Her themes, in facts she already approved (install, takedown, storage). "White-glove",
    // "gold standard", "professional-grade" and "magical" wait for her exact words.
    key: "why_choose_us",
    status: "approved",
    text: "We take care of everything: we put your lights up, take them down at the end of the season and store them, so you can spend the holidays with family instead of on a ladder.",
    by: CLG_DECIDED_BY_1029,
  },
  // Routine drive-by checks are not a standard service: never offered.
  { key: "drive_by_checks", status: "rejected", by: CLG_DECIDED_BY_1029 },
  // The assistant speaks for The Christmas Light Guys only: no sister companies, no other lighting businesses.
  { key: "sister_company", status: "rejected", by: CLG_DECIDED_BY_1029 },
  { key: "other_lighting", status: "rejected", by: CLG_DECIDED_BY_1029 },
];
