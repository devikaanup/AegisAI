import hazardsData from "@/data/hazards.json";
import profilesData from "@/data/profiles.json";
import { GraphEdge } from "@/scripts/generate-data";

export type HazardStateType = "safe" | "threatened" | "impassable";

export interface HazardEngineContext {
  edgeArrivalMin: Record<string, number | null>;
  rateCmPerMin: number;
}

const hazardCtx: HazardEngineContext = {
  edgeArrivalMin: hazardsData.edgeArrivalMin as Record<string, number | null>,
  rateCmPerMin: hazardsData.rateCmPerMin,
};

export function getEdgeFloodArrivalMin(edgeId: string): number | null {
  return hazardCtx.edgeArrivalMin[edgeId] ?? null;
}

export function getEdgeDepthCm(edgeId: string, currentMinute: number): number {
  const arrival = getEdgeFloodArrivalMin(edgeId);
  if (arrival === null || currentMinute <= arrival) {
    return 0;
  }
  return (currentMinute - arrival) * hazardCtx.rateCmPerMin;
}

export function getProfileDepthTolerance(profileId: string): number {
  const prof = (profilesData.profiles as Record<string, any>)[profileId];
  if (!prof) return 10;
  return prof.depthToleranceCm ?? 10;
}

export function getEdgeImpassableMin(edgeId: string, profileId: string): number | null {
  const arrival = getEdgeFloodArrivalMin(edgeId);
  if (arrival === null) return null;
  const tolerance = getProfileDepthTolerance(profileId);
  return arrival + tolerance / hazardCtx.rateCmPerMin;
}

export function getEdgeHazardState(
  edgeId: string,
  currentMinute: number,
  profileId: string
): HazardStateType {
  if (profileId === "standard") {
    return "safe";
  }

  const arrival = getEdgeFloodArrivalMin(edgeId);
  if (arrival === null || currentMinute < arrival) {
    return "safe";
  }

  const impassableMin = getEdgeImpassableMin(edgeId, profileId);
  if (impassableMin === null) return "safe";

  if (currentMinute >= impassableMin) {
    return "impassable";
  }

  // depth > 0 but under tolerance, OR impassable within the next 3 min
  const depth = (currentMinute - arrival) * hazardCtx.rateCmPerMin;
  const tolerance = getProfileDepthTolerance(profileId);
  if (depth > 0 || currentMinute + 3 >= impassableMin) {
    return "threatened";
  }

  return "safe";
}

export function isEdgePassableAtTime(
  edgeId: string,
  entryMinute: number,
  profileId: string
): boolean {
  if (profileId === "standard") return true;
  const impassableMin = getEdgeImpassableMin(edgeId, profileId);
  if (impassableMin === null) return true;
  return entryMinute < impassableMin;
}
