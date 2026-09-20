import { getGraph } from "./graph";
import { GraphEdge } from "@/scripts/generate-data";
import { getProfile, computeEdgeCost, ProfileDefinition } from "./costFunctions";
import { runDijkstra, DijkstraResultNode } from "./dijkstra";
import { ShelterState } from "./shelterEngine";
import sheltersData from "@/data/shelters.json";
import { getEdgeFloodArrivalMin, getEdgeImpassableMin, getEdgeDepthCm, isEdgePassableAtTime } from "./hazardEngine";

export type SafetyStatusType = "SAFE" | "TIGHT" | "WILL_NOT_REACH_SAFETY";

export interface EdgeAnnotation {
  edgeId: string;
  name: string;
  distance: number;
  entryTimeMin: number;
  exitTimeMin: number;
  floodArrivalMin: number | null;
  impassableMin: number | null;
  slackMin: number | null; // impassableMin - entryTimeMin
  depthAtEntryCm: number;
  isFlooding: boolean;
  blockReason?: string;
  penaltyMultiplier?: number;
}

export interface RouteResult {
  shelterId: string | null;
  shelterName: string | null;
  nodeIds: string[];
  edgeIds: string[];
  distanceM: number;
  etaSec: number;
  etaMin: number;
  rawWalkSec: number;
  accessibilityOverheadSec: number;
  hazardExposureSec: number;
  minFloodSlackSec: number;
  minFloodSlackMin: number;
  firstHazardEdge: { name: string; floodArrivalMin: number } | null;
  reachesSafety: boolean;
  safetyStatus: SafetyStatusType;
  edgeAnnotations: EdgeAnnotation[];
  unreachableReason?: string;
}

export type RejectionReasonCode =
  | "FULL"
  | "STAIRS_BLOCK"
  | "KERB_BLOCK"
  | "SLOPE_BLOCK"
  | "SURFACE_BLOCK"
  | "FLOOD_FIRST"
  | "SLOWER";

export interface RejectionExplanation {
  shelterId: string;
  shelterName: string;
  code: RejectionReasonCode;
  humanText: string;
  edgeName?: string;
  floodArrivalMin?: number;
  evacueeArrivalMin?: number;
  extraMin?: number;
  occupancy?: number;
  capacity?: number;
}

export interface StandardRouteComparison {
  shelterId: string;
  shelterName: string;
  nodeIds: string[];
  edgeIds: string[];
  distanceM: number;
  etaMin: number;
  reachesSafety: boolean;
  failedAtEdgeName: string | null;
  failedReasonCode: string | null;
  failureText: string | null;
  floodCutsAtMin: number | null;
}

/**
 * Multi-sink search: find the earliest arrival shelter with available capacity.
 */
export function findBestShelter(
  startNodeId: string,
  profile: ProfileDefinition,
  departureMinute: number,
  shelterStates: Record<string, ShelterState>
): RouteResult {
  const graph = getGraph();
  const departureSec = departureMinute * 60;

  // Run time-dependent Dijkstra
  const searchResults = runDijkstra(graph, {
    startNodeId,
    departureSec,
    profile,
  });

  // Evaluate all shelters with capacity
  let bestShelterId: string | null = null;
  let minArrivalSec = Infinity;

  for (const shelter of Object.values(shelterStates)) {
    if (!shelter.isFull) {
      const dest = searchResults[shelter.junctionId];
      if (dest && dest.arrivalSec < minArrivalSec) {
        minArrivalSec = dest.arrivalSec;
        bestShelterId = shelter.id;
      }
    }
  }

  if (!bestShelterId) {
    // Unreachable: check why
    let unreachableReason = "All reachable shelters full or cut off by flood";
    const startFlood = getEdgeFloodArrivalMin(graph.adj[startNodeId]?.[0]?.id || "");
    if (startFlood !== null && departureMinute >= startFlood) {
      unreachableReason = `Departure location flooded at minute ${startFlood}`;
    }

    return {
      shelterId: null,
      shelterName: null,
      nodeIds: [],
      edgeIds: [],
      distanceM: 0,
      etaSec: 0,
      etaMin: 0,
      rawWalkSec: 0,
      accessibilityOverheadSec: 0,
      hazardExposureSec: 0,
      minFloodSlackSec: 0,
      minFloodSlackMin: 0,
      firstHazardEdge: null,
      reachesSafety: false,
      safetyStatus: "WILL_NOT_REACH_SAFETY",
      edgeAnnotations: [],
      unreachableReason,
    };
  }

  const chosenShelter = shelterStates[bestShelterId];
  return reconstructRoute(
    graph,
    startNodeId,
    chosenShelter.junctionId,
    chosenShelter.id,
    chosenShelter.name,
    searchResults,
    departureSec,
    profile
  );
}

function reconstructRoute(
  graph: ReturnType<typeof getGraph>,
  startNodeId: string,
  destNodeId: string,
  shelterId: string,
  shelterName: string,
  searchResults: Record<string, DijkstraResultNode>,
  departureSec: number,
  profile: ProfileDefinition
): RouteResult {
  const nodeIds: string[] = [];
  const edgeIds: string[] = [];

  let curr = destNodeId;
  while (curr) {
    nodeIds.unshift(curr);
    const nodeRes = searchResults[curr];
    if (!nodeRes || !nodeRes.prevNodeId || !nodeRes.prevEdgeId) {
      break;
    }
    edgeIds.unshift(nodeRes.prevEdgeId);
    curr = nodeRes.prevNodeId;
  }

  // Walk forward to build precise per-edge telemetry and annotations
  let currentSec = departureSec;
  let totalDistanceM = 0;
  let hazardExposureSec = 0;
  let minFloodSlackSec = Infinity;
  let firstHazardEdge: { name: string; floodArrivalMin: number } | null = null;
  const edgeAnnotations: EdgeAnnotation[] = [];

  for (let i = 0; i < edgeIds.length; i++) {
    const edge = graph.edgeById[edgeIds[i]];
    const fromNode = graph.nodes[edge.from];
    const toNode = graph.nodes[edge.to];
    const cost = computeEdgeCost(edge, fromNode, toNode, profile);
    const traverseSec = (edge.distance / profile.speed) * cost.slowdown;

    const entryMin = currentSec / 60;
    const exitMin = (currentSec + traverseSec) / 60;
    const floodArrMin = getEdgeFloodArrivalMin(edge.id);
    const impassableMin = getEdgeImpassableMin(edge.id, profile.id);

    let slackMin: number | null = null;
    let isFlooding = false;

    if (floodArrMin !== null) {
      if (entryMin >= floodArrMin) {
        isFlooding = true;
        hazardExposureSec += traverseSec;
      }
      if (impassableMin !== null) {
        slackMin = impassableMin - entryMin;
        const slackSec = slackMin * 60;
        if (slackSec < minFloodSlackSec) {
          minFloodSlackSec = slackSec;
        }
      }
      if (!firstHazardEdge) {
        firstHazardEdge = { name: edge.name, floodArrivalMin: floodArrMin };
      }
    }

    const depth = getEdgeDepthCm(edge.id, entryMin);

    edgeAnnotations.push({
      edgeId: edge.id,
      name: edge.name,
      distance: edge.distance,
      entryTimeMin: Number(entryMin.toFixed(2)),
      exitTimeMin: Number(exitMin.toFixed(2)),
      floodArrivalMin: floodArrMin,
      impassableMin,
      slackMin: slackMin !== null ? Number(slackMin.toFixed(2)) : null,
      depthAtEntryCm: Number(depth.toFixed(1)),
      isFlooding,
      penaltyMultiplier: cost.slowdown,
    });

    totalDistanceM += edge.distance;
    currentSec += traverseSec;
  }

  const etaSec = currentSec - departureSec;
  const etaMin = Number((etaSec / 60).toFixed(1));
  const rawWalkSec = totalDistanceM / profile.speed;
  const accessibilityOverheadSec = Math.max(0, etaSec - rawWalkSec);
  const minFloodSlackMin = minFloodSlackSec === Infinity ? 999 : Number((minFloodSlackSec / 60).toFixed(1));

  let safetyStatus: SafetyStatusType = "SAFE";
  if (minFloodSlackSec <= 0) {
    safetyStatus = "WILL_NOT_REACH_SAFETY";
  } else if (minFloodSlackSec < 120) {
    // slack < 2 min
    safetyStatus = "TIGHT";
  }

  return {
    shelterId,
    shelterName,
    nodeIds,
    edgeIds,
    distanceM: Math.round(totalDistanceM),
    etaSec: Math.round(etaSec),
    etaMin,
    rawWalkSec: Math.round(rawWalkSec),
    accessibilityOverheadSec: Math.round(accessibilityOverheadSec),
    hazardExposureSec: Math.round(hazardExposureSec),
    minFloodSlackSec: minFloodSlackSec === Infinity ? 99999 : Math.round(minFloodSlackSec),
    minFloodSlackMin,
    firstHazardEdge,
    reachesSafety: safetyStatus !== "WILL_NOT_REACH_SAFETY",
    safetyStatus,
    edgeAnnotations,
  };
}

/**
 * Distance-only standard Dijkstra to the nearest shelter.
 */
export function standardRoute(startNodeId: string): RouteResult {
  const graph = getGraph();
  const standardProfile = getProfile("standard");
  const shelters = sheltersData as Array<{ id: string; name: string; junctionId: string }>;

  const searchResults = runDijkstra(graph, {
    startNodeId,
    departureSec: 0,
    profile: standardProfile,
    distanceOnly: true,
    ignoreHazards: true,
    ignoreProfileConstraints: true,
  });

  let bestShelter = shelters[0];
  let minArrival = Infinity;

  for (const s of shelters) {
    const res = searchResults[s.junctionId];
    if (res && res.arrivalSec < minArrival) {
      minArrival = res.arrivalSec;
      bestShelter = s;
    }
  }

  return reconstructRoute(
    graph,
    startNodeId,
    bestShelter.junctionId,
    bestShelter.id,
    bestShelter.name,
    searchResults,
    0,
    standardProfile
  );
}

/**
 * Replay the standard route for a specific profile at departure time t0.
 */
export function replayForProfile(
  stdRoute: RouteResult,
  profile: ProfileDefinition,
  departureMinute: number
): StandardRouteComparison {
  const graph = getGraph();
  let currentSec = departureMinute * 60;
  let reachesSafety = true;
  let failedAtEdgeName: string | null = null;
  let failedReasonCode: string | null = null;
  let failureText: string | null = null;
  let floodCutsAtMin: number | null = null;

  for (const edgeId of stdRoute.edgeIds) {
    const edge = graph.edgeById[edgeId];
    const fromNode = graph.nodes[edge.from];
    const toNode = graph.nodes[edge.to];

    const cost = computeEdgeCost(edge, fromNode, toNode, profile);
    const entryMin = currentSec / 60;
    const impassableMin = getEdgeImpassableMin(edge.id, profile.id);

    // Check physical barrier
    if (cost.blocked) {
      reachesSafety = false;
      failedAtEdgeName = edge.name;
      failedReasonCode = cost.reasons[0] || "BLOCKED";
      failureText = `${cost.reasons.join(", ")} on ${edge.name}`;
      break;
    }

    // Check flood barrier
    if (impassableMin !== null && entryMin >= impassableMin) {
      reachesSafety = false;
      failedAtEdgeName = edge.name;
      failedReasonCode = "FLOOD";
      floodCutsAtMin = Number(impassableMin.toFixed(1));
      failureText = `Flooded at ${edge.name} (impassable at ${floodCutsAtMin} min)`;
      break;
    }

    const traverseSec = (edge.distance / profile.speed) * cost.slowdown;
    currentSec += traverseSec;
  }

  const durationMin = Number(((currentSec - departureMinute * 60) / 60).toFixed(1));

  return {
    shelterId: stdRoute.shelterId || "S1",
    shelterName: stdRoute.shelterName || "Govt School",
    nodeIds: stdRoute.nodeIds,
    edgeIds: stdRoute.edgeIds,
    distanceM: stdRoute.distanceM,
    etaMin: durationMin,
    reachesSafety,
    failedAtEdgeName,
    failedReasonCode,
    failureText,
    floodCutsAtMin,
  };
}

/**
 * Diagnostic explanation for rejected shelters.
 */
export function explainRejections(
  startNodeId: string,
  profile: ProfileDefinition,
  departureMinute: number,
  chosenShelterId: string | null,
  shelterStates: Record<string, ShelterState>,
  chosenEtaMin?: number
): RejectionExplanation[] {
  const graph = getGraph();
  const departureSec = departureMinute * 60;
  const rejections: RejectionExplanation[] = [];

  for (const shelter of Object.values(shelterStates)) {
    if (shelter.id === chosenShelterId) {
      continue;
    }

    // 1. Capacity check
    if (shelter.isFull) {
      rejections.push({
        shelterId: shelter.id,
        shelterName: shelter.name,
        code: "FULL",
        occupancy: shelter.currentOccupancy,
        capacity: shelter.capacity,
        humanText: `${shelter.name} is at capacity (${shelter.currentOccupancy}/${shelter.capacity}) and cannot accept additional evacuees.`,
      });
      continue;
    }

    // 2. Physical accessibility diagnostic check (hazards ignored)
    const accessSearch = runDijkstra(graph, {
      startNodeId,
      departureSec,
      profile,
      ignoreHazards: true,
      ignoreProfileConstraints: false,
    });

    if (!accessSearch[shelter.junctionId]) {
      // Find the specific edge barrier that blocked reaching it
      // Run unconstrained search to trace the shortest geometric path to this shelter
      const unconstrainedSearch = runDijkstra(graph, {
        startNodeId,
        departureSec,
        profile,
        ignoreHazards: true,
        ignoreProfileConstraints: true,
      });

      let blockingEdge: GraphEdge | null = null;
      let blockingReason = "Physical barrier";
      let curr = shelter.junctionId;
      while (curr && curr !== startNodeId) {
        const step = unconstrainedSearch[curr];
        if (!step || !step.prevEdgeId) break;
        const e = graph.edgeById[step.prevEdgeId];
        const cost = computeEdgeCost(e, graph.nodes[e.from], graph.nodes[e.to], profile);
        if (cost.blocked) {
          blockingEdge = e;
          blockingReason = cost.reasons[0];
          break;
        }
        curr = step.prevNodeId!;
      }

      const edgeName = blockingEdge?.name || "Access route";
      let code: RejectionReasonCode = "STAIRS_BLOCK";
      if (blockingReason.startsWith("Kerb")) code = "KERB_BLOCK";
      else if (blockingReason.startsWith("Slope")) code = "SLOPE_BLOCK";
      else if (blockingReason.startsWith("Rough")) code = "SURFACE_BLOCK";

      rejections.push({
        shelterId: shelter.id,
        shelterName: shelter.name,
        code,
        edgeName,
        humanText: `${shelter.name} was excluded because ${edgeName} is inaccessible (${blockingReason}) to the selected profile.`,
      });
      continue;
    }

    // 3. Flood diagnostic check (profile constraints ignored)
    const normalSearch = runDijkstra(graph, {
      startNodeId,
      departureSec,
      profile,
      ignoreHazards: false,
      ignoreProfileConstraints: false,
    });

    if (!normalSearch[shelter.junctionId]) {
      // Reached with hazards ignored, but failed with hazards
      // Find the first flooded edge on the path
      let floodEdge: GraphEdge | null = null;
      let curr = shelter.junctionId;
      while (curr && curr !== startNodeId) {
        const step = accessSearch[curr];
        if (!step || !step.prevEdgeId) break;
        const e = graph.edgeById[step.prevEdgeId];
        const arr = getEdgeFloodArrivalMin(e.id);
        const impassable = getEdgeImpassableMin(e.id, profile.id);
        const entryMin = step.arrivalSec / 60;
        if (impassable !== null && entryMin >= impassable) {
          floodEdge = e;
          break;
        }
        curr = step.prevNodeId!;
      }

      const edgeName = floodEdge?.name || "Connecting street";
      const floodArr = floodEdge ? getEdgeFloodArrivalMin(floodEdge.id) ?? 10 : 10;
      const evacArr = floodEdge ? Number((accessSearch[floodEdge.from]?.arrivalSec / 60).toFixed(1)) : 12;

      rejections.push({
        shelterId: shelter.id,
        shelterName: shelter.name,
        code: "FLOOD_FIRST",
        edgeName,
        floodArrivalMin: floodArr,
        evacueeArrivalMin: evacArr,
        humanText: `${shelter.name} was excluded because flooding reaches ${edgeName} at minute ${floodArr} and the evacuee would arrive at minute ${evacArr}.`,
      });
      continue;
    }

    // 4. Reachable but slower
    const shelterEtaMin = Number(((normalSearch[shelter.junctionId].arrivalSec - departureSec) / 60).toFixed(1));
    const extraMin = chosenEtaMin !== undefined ? Number(Math.max(0, shelterEtaMin - chosenEtaMin).toFixed(1)) : 0;

    rejections.push({
      shelterId: shelter.id,
      shelterName: shelter.name,
      code: "SLOWER",
      extraMin,
      humanText: `${shelter.name} is reachable but takes ${extraMin > 0 ? `${extraMin} min longer` : `${shelterEtaMin} min`}.`,
    });
  }

  return rejections;
}
