import { describe, it, expect } from "vitest";
import { isTextGrounded, extractNumbers, collectContextNumbers } from "@/lib/groundingCheck";
import { buildExplanationContext } from "@/lib/explainContext";

describe("Grounding Check Verifier", () => {
  const context = buildExplanationContext(
    {
      evacueeId: "marcus",
      profileId: "wheelchair",
      simulationMinute: 0,
      peopleEvacuating: 10,
    },
    null
  );

  it("extracts numbers from text accurately", () => {
    expect(extractNumbers("Marcus was routed 700m in 9.7 min.")).toEqual([700, 9.7]);
    expect(extractNumbers("No numbers here")).toEqual([]);
  });

  it("collects context numbers into a comprehensive set", () => {
    const set = collectContextNumbers(context);
    expect(set.has(700)).toBe(true);
    expect(set.has(10)).toBe(true);
  });

  it("accepts text whose numbers are fully grounded in engine facts", () => {
    const groundedText = `Marcus is routed 700 meters to Govt School, arriving in 9.7 min with 9.7 min safety margin.`;
    expect(isTextGrounded(groundedText, context)).toBe(true);
  });

  it("rejects text containing invented / hallucinated numbers", () => {
    const hallucinatedText = `Marcus was routed 9999 meters and will reach shelter in 48.3 min with 92% confidence.`;
    expect(isTextGrounded(hallucinatedText, context)).toBe(false);
  });
});
