import profilesData from "@/data/profiles.json";
import { GraphEdge, GraphNode } from "@/scripts/generate-data";

export interface CostResult {
  blocked: boolean;
  reasons: string[];
  slowdown: number;
}

export interface ProfileDefinition {
  id: string;
  name: string;
  speed: number;
  depthToleranceCm: number;
  hardBlocks?: {
    stairs?: boolean;
    maxKerbCm?: number;
    maxSlopePct?: number;
    blockedSurfaces?: string[];
  };
  penalties?: Record<string, number>;
  needs: string[];
  hardConstraints: string[];
}

export function getProfile(profileId: string): ProfileDefinition {
  const prof = (profilesData.profiles as Record<string, ProfileDefinition>)[profileId];
  if (!prof) {
    return (profilesData.profiles as Record<string, ProfileDefinition>)["standard"];
  }
  return prof;
}

export function getAllProfiles(): ProfileDefinition[] {
  return Object.values(profilesData.profiles as Record<string, ProfileDefinition>);
}

export function computeEdgeCost(
  edge: GraphEdge,
  fromNode: GraphNode,
  toNode: GraphNode,
  profile: ProfileDefinition,
  _context?: any
): CostResult {
  const reasons: string[] = [];
  let blocked = false;
  let slowdown = 1.0;

  // 1. Check Hard Blocks
  if (profile.hardBlocks) {
    if (profile.hardBlocks.stairs && edge.stairs) {
      blocked = true;
      reasons.push("Steps");
    }
    if (
      profile.hardBlocks.maxKerbCm !== undefined &&
      edge.kerbCm > profile.hardBlocks.maxKerbCm
    ) {
      blocked = true;
      reasons.push(`Kerb ${edge.kerbCm}cm`);
    }
    if (
      profile.hardBlocks.maxSlopePct !== undefined &&
      edge.slope > profile.hardBlocks.maxSlopePct
    ) {
      blocked = true;
      reasons.push(`Slope ${edge.slope}%`);
    }
    if (
      profile.hardBlocks.blockedSurfaces &&
      profile.hardBlocks.blockedSurfaces.includes(edge.surface)
    ) {
      blocked = true;
      reasons.push(`Rough surface: ${edge.surface}`);
    }
  }

  // 2. Profile-specific slowdown multipliers
  if (profile.id === "wheelchair") {
    if (edge.slope > 4) {
      slowdown *= 1 + 0.1 * (edge.slope - 4);
    }
  } else if (profile.id === "stroller_newborn") {
    if (edge.slope > 4) {
      slowdown *= 1 + 0.1 * (edge.slope - 4);
    }
    if (edge.lanes >= 3 && edge.crossing === "unsignalized") {
      slowdown *= profile.penalties?.unsignalizedMultiLaneCrossing ?? 1.3;
    }
  } else if (profile.id === "mobility_limited") {
    if (edge.slope > 4) {
      slowdown *= 1 + 0.15 * (edge.slope - 4);
    }
    if (edge.surface === "gravel" || edge.surface === "dirt" || edge.surface === "cobble") {
      slowdown *= profile.penalties?.roughSurface ?? 1.4;
    }
    if (edge.kerbCm > 5) {
      slowdown *= profile.penalties?.kerbAbove5 ?? 1.3;
    }
  } else if (profile.id === "pregnant") {
    if (edge.stairs) {
      slowdown *= profile.penalties?.stairs ?? 2.5;
    }
    if (edge.surface === "gravel" || edge.surface === "dirt" || edge.surface === "cobble") {
      slowdown *= profile.penalties?.roughSurface ?? 2.0;
    }
    if (edge.slope > 6) {
      slowdown *= profile.penalties?.slopeAbove6 ?? 1.5;
    }
    if (edge.kerbCm > 5) {
      slowdown *= profile.penalties?.kerbAbove5 ?? 1.2;
    }
  } else if (profile.id === "cognitive") {
    // Junction complexity on arrival at toNode
    const deg = toNode.degree;
    if (deg === 3) {
      slowdown *= 1.1;
    } else if (deg >= 4) {
      slowdown *= 1 + (profile.penalties?.highDegreeJunctionFactor ?? 0.25) * (deg - 3);
    }

    if (edge.lanes >= 3 && edge.crossing === "unsignalized") {
      slowdown *= profile.penalties?.unsignalizedMultiLaneCrossing ?? 2.0;
    }

    // Landmark rich bonus
    if ((fromNode.poiScore ?? 0) >= 1 || (toNode.poiScore ?? 0) >= 1) {
      slowdown *= profile.penalties?.poiLandmarkBonus ?? 0.85;
    }
  }

  return {
    blocked,
    reasons,
    slowdown: Number(slowdown.toFixed(3)),
  };
}
