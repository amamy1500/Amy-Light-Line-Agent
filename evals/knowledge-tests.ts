import { isConflict, queueCategory, type Claim, type KnowledgeItem } from "@/lib/knowledge/model";

/**
 * Tests generated from the knowledge items, never written by hand: add a site
 * claim and its tests exist. Four families:
 *
 *  ask        "Site says X. Caller asks X. Can the agent answer?" — not until Amy approves.
 *  repeat     The agent repeats the site's words → flagged as an unapproved claim.
 *  conflict   "Christmas site says X, Light Guys says Y" → the agent must not choose either.
 *  approval   After Amy approves her words: the agent says exactly them; any site
 *             wording she did not approve stays flagged.
 */

export type GeneratedTest =
  | { family: "ask"; id: string; itemKey: string; topic: string; question: string; mustNotLeak: string[] }
  | { family: "repeat"; id: string; itemKey: string; brand: Claim["brand"]; spoken: string }
  | {
      family: "conflict";
      id: string;
      itemKey: string;
      kind: KnowledgeItem["kind"];
      /** Every value the sources give (the service area's city lists cannot be word-matched; its tool decides). */
      values: Array<{ brand: Claim["brand"]; value: string; spoken: string; detectable: boolean }>;
    }
  | {
      family: "approval";
      id: string;
      itemKey: string;
      kind: KnowledgeItem["kind"];
      topic: string;
      question: string;
      /** The words Amy approves in the test (her suggested text, or one site's version). */
      amyText: string;
      amyValue: KnowledgeItem["approvedValue"];
      /** Claims whose words Amy's text does not include: must stay flagged. */
      stillForbidden: Array<{ brand: Claim["brand"]; spoken: string }>;
    };

/** The words that would leak a claim through a tool answer. */
function leakWords(claim: Claim): string[] {
  return [claim.value, claim.quote].filter((w) => w.length >= 6 && !/^Proposed by/.test(w));
}

export function generateKnowledgeTests(items: readonly KnowledgeItem[]): GeneratedTest[] {
  const tests: GeneratedTest[] = [];
  for (const item of items) {
    const topic = item.topics[0] ?? item.key;
    tests.push({
      family: "ask",
      id: `ask:${item.key}`,
      itemKey: item.key,
      topic,
      question: item.callerQuestion,
      mustNotLeak: item.claims.flatMap(leakWords),
    });
    item.claims.forEach((claim, i) => {
      if (claim.markers.length) {
        tests.push({ family: "repeat", id: `repeat:${item.key}:${claim.brand}:${i}`, itemKey: item.key, brand: claim.brand, spoken: claim.spoken });
      }
    });
    if (isConflict(item)) {
      tests.push({
        family: "conflict",
        id: `conflict:${item.key}`,
        itemKey: item.key,
        kind: item.kind,
        values: item.claims.map((c) => ({ brand: c.brand, value: c.value, spoken: c.spoken, detectable: c.markers.length > 0 })),
      });
    }
    // Amy's words in the test: her suggested text, or (for a conflict) she picks one site's version.
    // For the service area she approves the five cities both sites list.
    const picked = item.claims.find((c) => c.markers.length) ?? item.claims[0];
    const cities = ["Austin", "Round Rock", "Pflugerville", "Georgetown", "Leander"];
    const amyText = item.kind === "service_area" ? `${cities.slice(0, -1).join(", ")} and ${cities.at(-1)}` : (item.suggestedText ?? picked?.spoken ?? item.title);
    const amyValue = item.kind === "service_area" ? { cities, zips: [] } : null;
    // A claim stays forbidden when its own words use a marker that Amy's text does not.
    const stillForbidden = item.claims
      .filter((c) => c.markers.some((m) => !new RegExp(m, "i").test(amyText) && new RegExp(m, "i").test(c.spoken)))
      .map((c) => ({ brand: c.brand, spoken: c.spoken }));
    tests.push({ family: "approval", id: `approval:${item.key}`, itemKey: item.key, kind: item.kind, topic, question: item.callerQuestion, amyText, amyValue, stillForbidden });
  }
  return tests;
}

/** One row per item for the approval queue, in the order Amy should work through it. */
export function queueOrder(items: readonly KnowledgeItem[]): KnowledgeItem[] {
  const rank = { conflict: 0, exact_words: 1, quick_confirm: 2, question_bank: 3 } as const;
  return [...items].sort((a, b) => rank[queueCategory(a)] - rank[queueCategory(b)] || a.title.localeCompare(b.title));
}
