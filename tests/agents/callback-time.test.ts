import { describe, expect, it } from "vitest";
import { callbackChoice, callbackQuestionFor, outsideCallbackHours, spokenCallbackHours, spokenClock } from "@/lib/agents/callback-time";
import { callbackCaller, parseBusinessConfig, type BusinessConfig } from "@/lib/business-rules/config";
import { christmasLightGuysConfig, upgradeChristmasLightGuysConfig } from "@/lib/business-rules/tenants/christmas-light-guys";

// Amy, 2026-10-29: callbacks go out on weekdays, 9 to 5, never nights or
// weekends; callers hear "our team"; the assistant steers a weekend or an
// evening to the next weekday, once.
const config = christmasLightGuysConfig();
// Austin is UTC-5 in late October.
const at = (local: string) => new Date(`${local}-05:00`);
const TUE_10AM = at("2026-10-20T10:00:00");
const TUE_4PM = at("2026-10-20T16:00:00");
const FRI_8PM = at("2026-10-23T20:00:00");
const outside = (said: string, now = TUE_10AM) => outsideCallbackHours(said, config, now);

describe("callback hours, in a caller's words", () => {
  it("says the hours and the question the way Amy approved them", () => {
    expect(spokenCallbackHours(config.callbackHours!)).toBe("on weekdays, between nine and five");
    expect(callbackQuestionFor(config)).toBe(
      "Our team returns calls on weekdays, between nine and five. When would be the best time to give you a call?",
    );
    expect(spokenClock("12:00")).toBe("noon");
    expect(spokenClock("17:30")).toBe("five thirty");
    expect(
      spokenCallbackHours([
        ...[1, 2, 3, 4, 5].map((day) => ({ day, open: "09:00", close: "17:00" })),
        { day: 6, open: "10:00", close: "14:00" },
      ]),
    ).toBe("on weekdays, between nine and five, and on Saturday, between ten and two");
  });

  it("without call hours, any time is fine and the old question stands", () => {
    const anyTime = { ...config, callbackHours: undefined, brand: { ...config.brand, callbackBy: "Josh" } };
    expect(callbackQuestionFor(anyTime)).toBe("When would be the best time for Josh to give you a call?");
    expect(outsideCallbackHours("Saturday at 8 pm", anyTime, TUE_10AM)).toBe(false);
  });

  it("offers the next two times the team could call", () => {
    expect(callbackChoice(config, TUE_10AM)).toBe("this afternoon or tomorrow morning");
    expect(callbackChoice(config, TUE_4PM)).toBe("tomorrow morning or afternoon");
    expect(callbackChoice(config, FRI_8PM)).toBe("Monday morning or afternoon");
    // A closed Monday moves it to Tuesday.
    const closedMonday = { ...config, closures: [{ date: "2026-10-26", label: "Crew day off" }] };
    expect(callbackChoice(closedMonday, FRI_8PM)).toBe("Tuesday morning or afternoon");
  });

  it("spots weekends, evenings and early mornings", () => {
    for (const said of ["Saturday morning", "this weekend", "weekends are best", "Sunday after church", "tonight", "weekday evenings", "after 6", "after five", "at 7 pm", "around eight at night", "before 9", "early morning before work"]) {
      expect(outside(said), said).toBe(true);
    }
    // "Tomorrow" on a Friday night is a Saturday.
    expect(outside("tomorrow after four", FRI_8PM)).toBe(true);
    expect(outside("tomorrow after four", TUE_10AM)).toBe(false);
  });

  it("leaves weekday daytime and unclear answers alone", () => {
    for (const said of ["Monday morning", "weekday mornings", "tomorrow after four", "after 2", "around noon", "at 10", "anytime", "lunchtime", "whenever works", "Thursday after 3:30", "by five", "Monday the 3rd", "in 2 weeks", "one more thing, Wednesday"]) {
      expect(outside(said), said).toBe(false);
    }
  });
});

describe("who calls back", () => {
  it("callers hear 'our team', and the lead page knows Amy dials", () => {
    expect(config.brand.callbackBy).toBe("our team");
    expect(callbackCaller(config)).toBe("Amy");
    expect(callbackCaller({ ...config, brand: { ...config.brand, callbackBy: "Josh" } })).toBe("Josh");
  });

  it("reads a config saved before callbackBy, which named Josh as callbackFirstName", () => {
    const { callbackBy: _, goodbye: __, ...brand } = config.brand;
    const old = parseBusinessConfig({ ...config, brand: { ...brand, callbackFirstName: "Josh" }, callbackHours: undefined });
    expect(old.brand.callbackBy).toBe("Josh");
  });
});

describe("bringing the live office up to this release", () => {
  const seededOct29 = (): BusinessConfig => {
    const { goodbye: _, ...brand } = config.brand;
    return parseBusinessConfig({
      ...config,
      configVersion: "clg-2026.10.29-1",
      brand: { ...brand, callbackFirstName: "Josh" },
      profile: { ...config.profile, collect: config.profile.collect.replace("our team", "Josh") },
      callbackHours: undefined,
    });
  };

  it("takes the new defaults where the old ones are still in place", () => {
    const upgraded = upgradeChristmasLightGuysConfig(seededOct29());
    expect(upgraded.configVersion).toBe(config.configVersion);
    expect(upgraded.brand.callbackBy).toBe("our team");
    expect(upgraded.brand.goodbye).toBe(config.brand.goodbye);
    expect(upgraded.profile.collect).toContain("the best time for our team to call back");
    expect(upgraded.callbackHours).toEqual(config.callbackHours);
  });

  it("keeps what Amy set herself, and does nothing to an office already on this release", () => {
    const amysHours = [{ day: 1, open: "10:00", close: "15:00" }];
    const hers = { ...seededOct29(), callbackHours: amysHours, brand: { ...seededOct29().brand, callbackBy: "Dana" } };
    const upgraded = upgradeChristmasLightGuysConfig(hers);
    expect(upgraded.callbackHours).toEqual(amysHours);
    expect(upgraded.brand.callbackBy).toBe("Dana");
    expect(upgradeChristmasLightGuysConfig(config)).toBe(config);
  });
});
