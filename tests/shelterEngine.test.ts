import { describe, it, expect } from "vitest";
import { computeShelterOccupancies, generateBackgroundEvacuees } from "@/lib/shelterEngine";

describe("Shelter Capacity & Background Population Engine", () => {
  it("generates deterministic background evacuees with seed 42", () => {
    const list1 = generateBackgroundEvacuees(20);
    const list2 = generateBackgroundEvacuees(20);

    expect(list1.length).toBe(20);
    expect(list1).toEqual(list2);
  });

  it("baseline occupancies correctly start at S1: 32/50, S2: 60/100, S3: 90/200", () => {
    const { shelters } = computeShelterOccupancies(0, 0);

    expect(shelters["S1"].currentOccupancy).toBe(32);
    expect(shelters["S1"].capacity).toBe(50);
    expect(shelters["S1"].isFull).toBe(false);

    expect(shelters["S2"].currentOccupancy).toBe(60);
    expect(shelters["S2"].capacity).toBe(100);

    expect(shelters["S3"].currentOccupancy).toBe(90);
    expect(shelters["S3"].capacity).toBe(200);
  });

  it("slider increases background occupancy and marks shelters full when reaching capacity", () => {
    // 50 evacuees will saturate S1 (32 + 18 = 50)
    const { shelters } = computeShelterOccupancies(50, 0);

    expect(shelters["S1"].currentOccupancy).toBe(50);
    expect(shelters["S1"].isFull).toBe(true);
    expect(shelters["S2"].currentOccupancy).toBeGreaterThan(60);
  });
});
