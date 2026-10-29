import { describe, expect, it } from "vitest";
import { extractLeadFields, toStoredFields, type ExtractedFields } from "@/lib/extraction";

// Golden set: synthetic voicemails in the shape Twilio transcribes them.
// Each expectation lists every field; anything not listed must be absent.
const GOLDEN: Array<{ name: string; transcript: string; expected: ExtractedFields }> = [
  {
    name: "full message",
    transcript:
      "Hi, this is Dana Whitfield. I'm at 4512 Oak Cove in Round Rock. We'd like the roofline and two trees done before Thanksgiving. Call me back after 5 pm. Thanks.",
    expected: {
      contactName: "Dana Whitfield",
      address: "4512 Oak Cove",
      serviceWanted: "roofline, trees",
      timing: "before Thanksgiving",
      callbackWindow: "after 5 pm",
    },
  },
  {
    name: "spoken callback number differs from caller ID",
    transcript:
      "Hey it's Marcus. Please call me on my cell 512-555-0188, anytime tomorrow. I want a quote for wreaths and garland on the front porch.",
    expected: {
      contactName: "Marcus",
      serviceWanted: "wreath, garland",
      callbackWindow: "anytime tomorrow",
      callbackPhone: "+15125550188",
    },
  },
  {
    name: "commercial permanent lighting",
    transcript:
      "Good morning, my name is Priya Raman, I manage a storefront at 900 Congress Avenue. We're interested in permanent lighting. Best time to reach me is in the morning.",
    expected: {
      contactName: "Priya Raman",
      address: "900 Congress Avenue",
      serviceWanted: "permanent lighting, commercial",
      callbackWindow: "in the morning",
    },
  },
  {
    name: "takedown only",
    transcript: "This is Ruth, 31 Pecan Trail. I need my lights taken down, so a takedown appointment as soon as possible please.",
    expected: { contactName: "Ruth", address: "31 Pecan Trail", serviceWanted: "takedown", timing: "as soon as possible" },
  },
  {
    name: "'I'm calling' is not a name",
    transcript: "Yeah I'm calling about getting lights on the house. I'm interested in a quote. Thanks.",
    expected: {},
  },
  {
    name: "silence / noise",
    transcript: "Hello? Hello. Okay.",
    expected: {},
  },
  {
    name: "empty transcript",
    transcript: "",
    expected: {},
  },
];

describe("extractLeadFields golden set", () => {
  it.each(GOLDEN)("$name", ({ transcript, expected }) => {
    expect(extractLeadFields(transcript).fields).toEqual(expected);
  });

  it("never invents a field: every extracted value appears in the transcript", () => {
    for (const { transcript } of GOLDEN) {
      const { fields } = extractLeadFields(transcript);
      for (const [key, value] of Object.entries(fields)) {
        if (key === "callbackPhone" || key === "serviceWanted") continue; // normalised forms
        expect(transcript.toLowerCase(), key).toContain(String(value).toLowerCase());
      }
    }
  });

  it("stores only string fields plus the method", () => {
    expect(toStoredFields(extractLeadFields("This is Ruth, 31 Pecan Trail."))).toEqual({
      method: "rules-v1",
      contactName: "Ruth",
      address: "31 Pecan Trail",
    });
  });
});
