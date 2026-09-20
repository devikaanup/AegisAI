import * as turf from "@turf/turf";
import * as fs from "fs";
import * as path from "path";
import { ANCHOR_LNGLAT, FLOOD_RATE_CM_PER_MIN } from "../lib/config";

// Deterministic PRNG (Mulberry32)
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const prng = mulberry32(1337);

// Convert local meters (x east, y north) from anchor to [lng, lat]
function metersToLngLat(xMeters: number, yMeters: number): [number, number] {
  const origin = turf.point(ANCHOR_LNGLAT);
  // move east xMeters
  const eastPt = xMeters !== 0 ? turf.destination(origin, xMeters / 1000, 90, { units: "kilometers" }) : origin;
  // move north yMeters
  const northPt = yMeters !== 0 ? turf.destination(eastPt, yMeters / 1000, 0, { units: "kilometers" }) : eastPt;
  return northPt.geometry.coordinates as [number, number];
}

interface CoarseJunction {
  id: string;
  row: number;
  col: number;
  x: number;
  y: number;
  lngLat: [number, number];
  elevation: number;
  poiScore: number;
  poiName?: string;
}

interface CoarseEdge {
  id: string;
  u: string;
  v: string;
  length: number;
  name: string;
  surface: "asphalt" | "gravel" | "cobble" | "dirt";
  stairs: boolean;
  kerbCm: number;
  lanes: number;
  crossing: "none" | "signalized" | "unsignalized";
}

export interface GraphNode {
  id: string;
  lat: number;
  lng: number;
  elevation: number;
  type: "junction" | "shape";
  degree: number;
  poiScore: number;
  poiName?: string;
  coarseJunctionId?: string;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  distance: number;
  slope: number; // computed from endpoint elevations and distance
  surface: "asphalt" | "gravel" | "cobble" | "dirt";
  stairs: boolean;
  kerbCm: number;
  crossing: "none" | "signalized" | "unsignalized";
  lanes: number;
  name: string;
  coarseId: string;
}

const POI_JUNCTIONS: Record<string, { poiScore: number; poiName: string }> = {
  r0c1: { poiScore: 1, poiName: "Riverside Pharmacy" },
  r1c2: { poiScore: 2, poiName: "Ancient Temple" },
  r2c2: { poiScore: 1, poiName: "Primary School" },
  r2c4: { poiScore: 1, poiName: "Apex Bank" },
  r3c3: { poiScore: 2, poiName: "Heights Clinic" },
};

const ROW_NAMES = ["Riverside Rd", "Market St", "Temple Rd", "Ridge Rd"];
const COL_NAMES = ["Lane 1", "Lane 2", "Lane 3", "Lane 4", "Lane 5", "Lane 6"];

function main() {
  console.log("Generating deterministic neighborhood graph for Riverside Heights...");

  // 1. Build Coarse Junctions (4 rows, 6 cols)
  const junctions: Record<string, CoarseJunction> = {};
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 6; c++) {
      const id = `r${r}c${c}`;
      const x = c * 200;
      const y = r * 150;
      const lngLat = metersToLngLat(x, y);
      let elevation = 2 + r * 4 + c * 0.5;
      if (id === "r2c3") {
        elevation = 21; // Temple Hill
      }
      const poiInfo = POI_JUNCTIONS[id] || { poiScore: 0, poiName: undefined };

      junctions[id] = {
        id,
        row: r,
        col: c,
        x,
        y,
        lngLat,
        elevation: Number(elevation.toFixed(1)),
        poiScore: poiInfo.poiScore,
        poiName: poiInfo.poiName,
      };
    }
  }

  // 2. Build Coarse Edges
  const coarseEdges: CoarseEdge[] = [];
  const edgeSet = new Set<string>();

  function addCoarseEdge(u: string, v: string, edgeProps: Partial<CoarseEdge> = {}) {
    const sortedKey = [u, v].sort().join("-");
    if (edgeSet.has(sortedKey)) return;
    edgeSet.add(sortedKey);

    const jU = junctions[u];
    const jV = junctions[v];
    const defaultLength =
      jU.row === jV.row
        ? Math.abs(jU.col - jV.col) * 200
        : jU.col === jV.col
        ? Math.abs(jU.row - jV.row) * 150
        : Math.round(Math.hypot(jU.x - jV.x, jU.y - jV.y));

    let defaultName = "Connecting Way";
    if (jU.row === jV.row) {
      defaultName = ROW_NAMES[jU.row];
    } else if (jU.col === jV.col) {
      defaultName = COL_NAMES[jU.col];
    }

    const coarseEdge: CoarseEdge = {
      id: `${u}-${v}`,
      u,
      v,
      length: edgeProps.length ?? defaultLength,
      name: edgeProps.name ?? defaultName,
      surface: edgeProps.surface ?? "asphalt",
      stairs: edgeProps.stairs ?? false,
      kerbCm: edgeProps.kerbCm ?? 0,
      lanes: edgeProps.lanes ?? 2,
      crossing: edgeProps.crossing ?? "none",
    };

    coarseEdges.push(coarseEdge);
  }

  // Standard 4-neighbour grid edges
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 6; c++) {
      if (c + 1 < 6) {
        addCoarseEdge(`r${r}c${c}`, `r${r}c${c + 1}`);
      }
      if (r + 1 < 4) {
        addCoarseEdge(`r${r}c${c}`, `r${r + 1}c${c}`);
      }
    }
  }

  // Apply REMOVALS: r2c1-r2c2, r0c3-r0c4
  const removedKeys = new Set([["r2c1", "r2c2"].sort().join("-"), ["r0c3", "r0c4"].sort().join("-")]);
  const filteredCoarseEdges = coarseEdges.filter((e) => !removedKeys.has([e.u, e.v].sort().join("-")));

  // Apply ADDITIONS:
  // Diagonals: r1c3-r0c2 (250m), r1c3-r2c4 (250m)
  filteredCoarseEdges.push({
    id: "r1c3-r0c2",
    u: "r1c3",
    v: "r0c2",
    length: 250,
    name: "Temple Diagonal Link",
    surface: "asphalt",
    stairs: false,
    kerbCm: 0,
    lanes: 2,
    crossing: "none",
  });

  filteredCoarseEdges.push({
    id: "r1c3-r2c4",
    u: "r1c3",
    v: "r2c4",
    length: 250,
    name: "Bazaar Diagonal Way",
    surface: "asphalt",
    stairs: false,
    kerbCm: 0,
    lanes: 2,
    crossing: "none",
  });

  // Apply Overrides:
  // - Steps: r1c1-r2c1 (length 90, name "Temple Steps"); r1c4-r2c4 (length 100, name "Bazaar Steps")
  // - Kerb 15cm, no cut: r1c4-r1c5, r0c1-r0c2
  // - Surface gravel: r2c0-r2c1. Cobble: r2c4-r2c5. Dirt: r0c4-r0c5
  // - lanes 4, crossing "unsignalized": r1c2-r1c3. lanes 4, crossing "signalized": r2c2-r2c3
  for (const edge of filteredCoarseEdges) {
    const key = [edge.u, edge.v].sort().join("-");
    if (key === ["r1c1", "r2c1"].sort().join("-")) {
      edge.length = 90;
      edge.stairs = true;
      edge.name = "Temple Steps";
    } else if (key === ["r1c4", "r2c4"].sort().join("-")) {
      edge.length = 100;
      edge.stairs = true;
      edge.name = "Bazaar Steps";
    } else if (key === ["r1c4", "r1c5"].sort().join("-")) {
      edge.kerbCm = 15;
    } else if (key === ["r0c1", "r0c2"].sort().join("-")) {
      edge.kerbCm = 15;
    } else if (key === ["r2c0", "r2c1"].sort().join("-")) {
      edge.surface = "gravel";
    } else if (key === ["r2c4", "r2c5"].sort().join("-")) {
      edge.surface = "cobble";
    } else if (key === ["r0c4", "r0c5"].sort().join("-")) {
      edge.surface = "dirt";
    } else if (key === ["r1c2", "r1c3"].sort().join("-")) {
      edge.lanes = 4;
      edge.crossing = "unsignalized";
    } else if (key === ["r2c2", "r2c3"].sort().join("-")) {
      edge.lanes = 4;
      edge.crossing = "signalized";
    }
  }

  // 3. Micro-Subdivision (split each coarse edge into segments <= 40m)
  const nodes: Record<string, GraphNode> = {};
  const fineEdges: GraphEdge[] = [];
  let shapeNodeIndex = 1;

  // Add all coarse junctions first
  for (const j of Object.values(junctions)) {
    nodes[j.id] = {
      id: j.id,
      lat: j.lngLat[1],
      lng: j.lngLat[0],
      elevation: j.elevation,
      type: "junction",
      degree: 0,
      poiScore: j.poiScore,
      poiName: j.poiName,
      coarseJunctionId: j.id,
    };
  }

  // Subdivide each coarse edge
  for (const coarse of filteredCoarseEdges) {
    const numSegments = Math.max(1, Math.ceil(coarse.length / 40));
    const uJunction = junctions[coarse.u];
    const vJunction = junctions[coarse.v];

    const segLength = coarse.length / numSegments;
    const pathNodes: GraphNode[] = [nodes[coarse.u]];

    for (let s = 1; s < numSegments; s++) {
      const frac = s / numSegments;
      // Interpolate coordinates in local meters
      let x = uJunction.x + frac * (vJunction.x - uJunction.x);
      let y = uJunction.y + frac * (vJunction.y - uJunction.y);

      // Add small deterministic lateral jitter (perpendicular to direction)
      const dx = vJunction.x - uJunction.x;
      const dy = vJunction.y - uJunction.y;
      const len = Math.hypot(dx, dy);
      const nx = -dy / len;
      const ny = dx / len;
      // Jitter magnitude: +/- 3.5 meters
      const jitter = (prng() - 0.5) * 7.0;
      x += nx * jitter;
      y += ny * jitter;

      const lngLat = metersToLngLat(x, y);
      const elevation = Number((uJunction.elevation + frac * (vJunction.elevation - uJunction.elevation)).toFixed(1));

      const shapeId = `s_${coarse.u}_${coarse.v}_${s}`;
      const shapeNode: GraphNode = {
        id: shapeId,
        lat: lngLat[1],
        lng: lngLat[0],
        elevation,
        type: "shape",
        degree: 0,
        poiScore: 0,
      };
      nodes[shapeId] = shapeNode;
      pathNodes.push(shapeNode);
    }
    pathNodes.push(nodes[coarse.v]);

    // Create fine edges for both directions
    for (let i = 0; i < pathNodes.length - 1; i++) {
      const fromNode = pathNodes[i];
      const toNode = pathNodes[i + 1];

      // Slope % = |elevTo - elevFrom| / segLength * 100
      const slope = Number(((Math.abs(toNode.elevation - fromNode.elevation) / segLength) * 100).toFixed(1));

      const edgeForward: GraphEdge = {
        id: `${fromNode.id}->${toNode.id}`,
        from: fromNode.id,
        to: toNode.id,
        distance: Number(segLength.toFixed(1)),
        slope,
        surface: coarse.surface,
        stairs: coarse.stairs,
        kerbCm: coarse.kerbCm,
        crossing: coarse.crossing,
        lanes: coarse.lanes,
        name: coarse.name,
        coarseId: coarse.id,
      };

      const edgeBackward: GraphEdge = {
        id: `${toNode.id}->${fromNode.id}`,
        from: toNode.id,
        to: fromNode.id,
        distance: Number(segLength.toFixed(1)),
        slope,
        surface: coarse.surface,
        stairs: coarse.stairs,
        kerbCm: coarse.kerbCm,
        crossing: coarse.crossing,
        lanes: coarse.lanes,
        name: coarse.name,
        coarseId: coarse.id,
      };

      fineEdges.push(edgeForward, edgeBackward);
    }
  }

  // Calculate degrees for all nodes
  const nodeDegrees: Record<string, number> = {};
  for (const e of fineEdges) {
    nodeDegrees[e.from] = (nodeDegrees[e.from] || 0) + 1;
  }
  for (const id of Object.keys(nodes)) {
    nodes[id].degree = nodeDegrees[id] || 0;
  }

  const undirectedEdgeCount = fineEdges.length / 2;
  const nodeCount = Object.keys(nodes).length;
  console.log(`Generated graph: ${nodeCount} nodes, ${undirectedEdgeCount} undirected edges (${fineEdges.length} directed edges).`);
  console.log(`Complex intersection r1c3 degree: ${nodes["r1c3"].degree}`);

  // 4. Hazards Definition (/data/hazards.json)
  // Junction arrivals: row 0 = 4; row 1 = 10 (cols 4-5 = 16); r2c0, r2c1, r2c2 = 22; others null.
  const junctionArrivalMin: Record<string, number | null> = {};
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 6; c++) {
      const jId = `r${r}c${c}`;
      if (r === 0) {
        junctionArrivalMin[jId] = 4;
      } else if (r === 1) {
        if (c >= 4) {
          junctionArrivalMin[jId] = 16;
        } else {
          junctionArrivalMin[jId] = 10;
        }
      } else if (r === 2 && (c === 0 || c === 1 || c === 2)) {
        junctionArrivalMin[jId] = 22;
      } else {
        junctionArrivalMin[jId] = null;
      }
    }
  }

  // Shelters never flood
  junctionArrivalMin["r3c1"] = null;
  junctionArrivalMin["r3c4"] = null;
  junctionArrivalMin["r2c5"] = null;

  // Compute node arrivals for all nodes
  const nodeArrivalMin: Record<string, number | null> = {};
  for (const node of Object.values(nodes)) {
    if (node.type === "junction") {
      nodeArrivalMin[node.id] = junctionArrivalMin[node.id] ?? null;
    } else {
      // Shape node: id format s_u_v_s
      const parts = node.id.split("_");
      const u = parts[1];
      const v = parts[2];
      const segIndex = parseInt(parts[3], 10);
      const coarseEdge = filteredCoarseEdges.find(
        (e) => (e.u === u && e.v === v) || (e.u === v && e.v === u)
      );
      const totalSegs = coarseEdge ? Math.max(1, Math.ceil(coarseEdge.length / 40)) : 2;
      const frac = segIndex / totalSegs;

      const arrU = junctionArrivalMin[u] ?? 45;
      const arrV = junctionArrivalMin[v] ?? 45;

      // If either touches a shelter node, or both >= 30, never
      if (u === "r3c1" || u === "r3c4" || u === "r2c5" || v === "r3c1" || v === "r3c4" || v === "r2c5") {
        nodeArrivalMin[node.id] = null;
      } else {
        const interp = arrU + frac * (arrV - arrU);
        if (interp >= 30) {
          nodeArrivalMin[node.id] = null;
        } else {
          nodeArrivalMin[node.id] = Number(interp.toFixed(1));
        }
      }
    }
  }

  // Edge arrival = min of endpoint arrivals (null if both null)
  const edgeArrivalMin: Record<string, number | null> = {};
  for (const e of fineEdges) {
    const arrFrom = nodeArrivalMin[e.from];
    const arrTo = nodeArrivalMin[e.to];
    if (arrFrom === null && arrTo === null) {
      edgeArrivalMin[e.id] = null;
    } else if (arrFrom === null) {
      edgeArrivalMin[e.id] = arrTo;
    } else if (arrTo === null) {
      edgeArrivalMin[e.id] = arrFrom;
    } else {
      edgeArrivalMin[e.id] = Math.min(arrFrom, arrTo);
    }
  }

  const hazardsData = {
    type: "flood",
    rateCmPerMin: FLOOD_RATE_CM_PER_MIN,
    junctionArrivalMin,
    nodeArrivalMin,
    edgeArrivalMin,
  };

  // 5. Shelters Definition (/data/shelters.json)
  const sheltersData = [
    {
      id: "S1",
      name: "Govt School",
      junctionId: "r3c1",
      capacity: 50,
      baselineOccupancy: 32,
    },
    {
      id: "S2",
      name: "Community Hall",
      junctionId: "r3c4",
      capacity: 100,
      baselineOccupancy: 60,
    },
    {
      id: "S3",
      name: "District Sports Complex",
      junctionId: "r2c5",
      capacity: 200,
      baselineOccupancy: 90,
    },
  ];

  // 6. Profiles Definition (/data/profiles.json)
  const profilesData = {
    wheelchair: {
      id: "wheelchair",
      name: "Wheelchair User",
      speed: 1.2,
      depthToleranceCm: 10,
      hardBlocks: {
        stairs: true,
        maxKerbCm: 5,
        maxSlopePct: 8,
        blockedSurfaces: ["gravel", "dirt", "cobble"],
      },
      needs: ["No stairs", "Kerbs <= 5cm", "Slope <= 8%", "Paved surfaces only"],
      hardConstraints: ["stairs", "kerb > 5cm", "slope > 8%", "rough surface"],
    },
    stroller_newborn: {
      id: "stroller_newborn",
      name: "Parent + Stroller",
      speed: 1.0,
      depthToleranceCm: 10,
      hardBlocks: {
        stairs: true,
        maxKerbCm: 5,
        maxSlopePct: 8,
        blockedSurfaces: ["gravel", "dirt", "cobble"],
      },
      penalties: {
        unsignalizedMultiLaneCrossing: 1.3,
      },
      needs: ["No stairs", "Kerbs <= 5cm", "Slope <= 8%", "Protected crossings"],
      hardConstraints: ["stairs", "kerb > 5cm", "slope > 8%", "rough surface"],
    },
    mobility_limited: {
      id: "mobility_limited",
      name: "Mobility Limited",
      speed: 0.9,
      depthToleranceCm: 15,
      hardBlocks: {
        stairs: true,
      },
      penalties: {
        roughSurface: 1.4,
        kerbAbove5: 1.3,
        slopeOver4Factor: 0.15,
      },
      needs: ["No stairs", "Gentle slopes", "Smooth terrain"],
      hardConstraints: ["stairs"],
    },
    pregnant: {
      id: "pregnant",
      name: "Pregnant",
      speed: 1.0,
      depthToleranceCm: 15,
      hardBlocks: {},
      penalties: {
        stairs: 2.5,
        roughSurface: 2.0,
        slopeAbove6: 1.5,
        kerbAbove5: 1.2,
      },
      needs: ["Paved walkways", "Low grade inclines", "Avoid stairs if possible"],
      hardConstraints: [],
    },
    cognitive: {
      id: "cognitive",
      name: "Cognitive Accessibility",
      speed: 1.1,
      depthToleranceCm: 20,
      hardBlocks: {},
      penalties: {
        unsignalizedMultiLaneCrossing: 2.0,
        highDegreeJunctionFactor: 0.25, // 1 + 0.25*(deg - 3) for deg >= 4
        poiLandmarkBonus: 0.85,
      },
      needs: ["Simple intersections", "Recognizable landmarks", "Signalized crossings"],
      hardConstraints: [],
    },
    standard: {
      id: "standard",
      name: "Standard Walker",
      speed: 1.4,
      depthToleranceCm: 999, // ignores hazard in baseline comparison
      hardBlocks: {},
      needs: ["Shortest path"],
      hardConstraints: [],
    },
  };

  // Preset evacuees
  const evacueesData = [
    { id: "marcus", name: "Marcus", startJunction: "r1c1", profile: "wheelchair", displaySpeed: 1.2 },
    { id: "ravi", name: "Ravi", startJunction: "r0c3", profile: "mobility_limited", displaySpeed: 0.9 },
    { id: "priya", name: "Priya", startJunction: "r1c4", profile: "pregnant", displaySpeed: 1.0 },
    { id: "meera", name: "Meera", startJunction: "r0c0", profile: "stroller_newborn", displaySpeed: 1.0 },
    { id: "arjun", name: "Arjun", startJunction: "r1c2", profile: "cognitive", displaySpeed: 1.1 },
  ];

  // 7. Roads GeoJSON (/data/roads.geojson)
  const roadFeatures = fineEdges
    .filter((e) => e.from < e.to) // one feature per undirected segment
    .map((e) => {
      const fNode = nodes[e.from];
      const tNode = nodes[e.to];
      return turf.lineString(
        [
          [fNode.lng, fNode.lat],
          [tNode.lng, tNode.lat],
        ],
        {
          id: e.id,
          name: e.name,
          surface: e.surface,
          stairs: e.stairs,
          kerbCm: e.kerbCm,
          lanes: e.lanes,
          crossing: e.crossing,
          slope: e.slope,
          coarseId: e.coarseId,
        }
      );
    });
  const roadsGeoJSON = turf.featureCollection(roadFeatures);

  // 8. Precompute Flood Polygons for Minutes 0..30 (/data/floodPolygons.json)
  console.log("Precomputing flood extent polygons for minutes 0 through 30...");
  const floodPolygons: Record<number, any> = {};

  for (let minute = 0; minute <= 30; minute++) {
    // Find all edges flooded at or before this minute (arrivalMin <= minute)
    const floodedFeatures: any[] = [];
    for (const e of fineEdges) {
      if (e.from < e.to) {
        const arr = edgeArrivalMin[e.id];
        if (arr !== null && arr <= minute) {
          const fNode = nodes[e.from];
          const tNode = nodes[e.to];
          const line = turf.lineString([
            [fNode.lng, fNode.lat],
            [tNode.lng, tNode.lat],
          ]);
          // Buffer line by ~35 meters to form water body
          const buffered = turf.buffer(line, 0.035, { units: "kilometers" });
          if (buffered) {
            floodedFeatures.push(buffered);
          }
        }
      }
    }

    if (floodedFeatures.length === 0) {
      floodPolygons[minute] = null;
    } else {
      let unionPoly: any = floodedFeatures[0];
      for (let i = 1; i < floodedFeatures.length; i++) {
        try {
          const u = turf.union(turf.featureCollection([unionPoly, floodedFeatures[i]]));
          if (u) unionPoly = u;
        } catch {
          // fallback ignore union error on complex degenerate geometry
        }
      }
      floodPolygons[minute] = unionPoly;
    }
  }

  // 9. Write all data to /data directory
  const dataDir = path.resolve(__dirname, "../data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(dataDir, "graph.json"),
    JSON.stringify({ nodes, edges: fineEdges }, null, 2)
  );
  fs.writeFileSync(path.join(dataDir, "hazards.json"), JSON.stringify(hazardsData, null, 2));
  fs.writeFileSync(path.join(dataDir, "shelters.json"), JSON.stringify(sheltersData, null, 2));
  fs.writeFileSync(
    path.join(dataDir, "profiles.json"),
    JSON.stringify({ profiles: profilesData, evacuees: evacueesData }, null, 2)
  );
  fs.writeFileSync(path.join(dataDir, "roads.geojson"), JSON.stringify(roadsGeoJSON, null, 2));
  fs.writeFileSync(path.join(dataDir, "roads.json"), JSON.stringify(roadsGeoJSON, null, 2));
  fs.writeFileSync(path.join(dataDir, "floodPolygons.json"), JSON.stringify(floodPolygons, null, 2));

  console.log("Successfully wrote all data files to /data!");
}

main();
