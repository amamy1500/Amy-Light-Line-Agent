import { describe, expect, it } from "vitest";
import { cityOf, dayLabel, initials, relativeWhen } from "@/lib/server/inbox-labels";

const TZ = "America/Chicago";
const NOW = new Date("2026-11-10T22:30:00Z"); // Tue Nov 10, 4:30 PM in Austin

describe("inbox labels", () => {
  it("say when a call came in, in Austin time", () => {
    expect(relativeWhen(new Date("2026-11-10T22:29:40Z"), NOW, TZ)).toBe("just now");
    expect(relativeWhen(new Date("2026-11-10T22:18:00Z"), NOW, TZ)).toBe("12 min ago");
    expect(relativeWhen(new Date("2026-11-10T17:58:00Z"), NOW, TZ)).toBe("4 h ago");
    expect(relativeWhen(new Date("2026-11-09T22:20:00Z"), NOW, TZ)).toBe("Yesterday 4:20 PM");
    expect(relativeWhen(new Date("2026-11-04T16:59:00Z"), NOW, TZ)).toBe("Wed 10:59 AM");
    expect(relativeWhen(new Date("2026-10-30T14:59:00Z"), NOW, TZ)).toBe("Oct 30");
  });

  it("group by the business's day, not the server's", () => {
    // 11:30 PM in Austin is already the next day in UTC; it still belongs to "Yesterday".
    expect(dayLabel(new Date("2026-11-10T05:30:00Z"), NOW, TZ)).toBe("Yesterday");
    expect(dayLabel(new Date("2026-11-10T14:00:00Z"), NOW, TZ)).toBe("Today");
    expect(dayLabel(new Date("2026-11-09T05:30:00Z"), NOW, TZ)).toBe("Sunday, Nov 8");
    expect(dayLabel(new Date("2026-10-30T14:59:00Z"), NOW, TZ)).toBe("Oct 30");
  });

  it("pull the city out of the addresses callers give", () => {
    expect(cityOf("444 Shoal Creek Boulevard, Austin, Texas 78759")).toBe("Austin");
    expect(cityOf("1406 Prairie Rose Ln, Round Rock")).toBe("Round Rock");
    expect(cityOf("2014A Rab Glen, Austin, Texas 78704")).toBe("Austin");
    expect(cityOf("2207 S 3rd St, Austin 78704")).toBe("Austin");
    expect(cityOf("Rough Hollow HOA entrance")).toBeNull();
    expect(cityOf(null)).toBeNull();
  });

  it("make initials for the avatar", () => {
    expect(initials("Sam Patel")).toBe("SP");
    expect(initials("Colton")).toBe("C");
    expect(initials("Mary Ann de la Cruz")).toBe("MC");
    expect(initials(null)).toBe("#");
    expect(initials("(512) 555-0147")).toBe("#");
  });
});
