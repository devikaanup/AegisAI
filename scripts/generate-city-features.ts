import * as turf from "@turf/turf";
import * as fs from "fs";
import * as path from "path";
import { ANCHOR_LNGLAT } from "../lib/config";

// Deterministic PRNG
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const prng = mulberry32(42);

// Convert local meters (x east, y north) from anchor to [lng, lat]
function metersToLngLat(xMeters: number, yMeters: number): [number, number] {
  const origin = turf.point(ANCHOR_LNGLAT);
  const eastPt = xMeters !== 0 ? turf.destination(origin, xMeters / 1000, 90, { units: "kilometers" }) : origin;
  const northPt = yMeters !== 0 ? turf.destination(eastPt, yMeters / 1000, 0, { units: "kilometers" }) : eastPt;
  return northPt.geometry.coordinates as [number, number];
}

function rectPolygon(xMin: number, yMin: number, xMax: number, yMax: number): any {
  const p1 = metersToLngLat(xMin, yMin);
  const p2 = metersToLngLat(xMax, yMin);
  const p3 = metersToLngLat(xMax, yMax);
  const p4 = metersToLngLat(xMin, yMax);
  return turf.polygon([[p1, p2, p3, p4, p1]]);
}

function circlePolygon(cx: number, cy: number, radiusMeters: number, numPoints = 8): any {
  const coords: [number, number][] = [];
  for (let i = 0; i <= numPoints; i++) {
    const angle = (i * 2 * Math.PI) / numPoints;
    const px = cx + radiusMeters * Math.cos(angle);
    const py = cy + radiusMeters * Math.sin(angle);
    coords.push(metersToLngLat(px, py));
  }
  return turf.polygon([coords]);
}

function main() {
  console.log("Generating expansive 3D GIS city features (buildings, trees, parks, canals) for South Chennai...");

  const buildingsFeatures: any[] = [];
  const landuseFeatures: any[] = [];

  // Helper: add 3D tree (elevated canopy + trunk)
  function addTree(cx: number, cy: number, radius = 3.5, height = 7, color = "#15803d") {
    // 3D Tree Canopy (elevated fill-extrusion)
    const canopy = circlePolygon(cx, cy, radius, 8);
    canopy.properties = {
      name: "Tree Canopy",
      type: "tree",
      height: height,
      base_height: 1.8,
      color: color,
    };
    buildingsFeatures.push(canopy);

    // Tree Trunk
    const trunk = circlePolygon(cx, cy, 0.7, 6);
    trunk.properties = {
      name: "Tree Trunk",
      type: "tree_trunk",
      height: 2.0,
      base_height: 0,
      color: "#382314",
    };
    buildingsFeatures.push(trunk);
  }

  // Helper: add building with Chennai-style rooftop water tank / lift shaft
  function addBuilding(
    xMin: number,
    yMin: number,
    xMax: number,
    yMax: number,
    height: number,
    name: string,
    type: string,
    color: string,
    highlightColor?: string
  ) {
    const b = rectPolygon(xMin, yMin, xMax, yMax);
    b.properties = {
      name,
      type,
      height,
      base_height: 0,
      color,
      highlightColor,
    };
    buildingsFeatures.push(b);

    // Rooftop water tank / lift machine room typical of Chennai architecture
    if (height >= 12 && (xMax - xMin) > 16 && (yMax - yMin) > 14) {
      const tankWidth = Math.min(10, (xMax - xMin) * 0.35);
      const tankDepth = Math.min(8, (yMax - yMin) * 0.35);
      const tankX = xMin + 4;
      const tankY = yMin + 4;
      const tank = rectPolygon(tankX, tankY, tankX + tankWidth, tankY + tankDepth);
      tank.properties = {
        name: `${name} Rooftop Structure`,
        type: "rooftop_tank",
        height: height + 2.8,
        base_height: height,
        color: "#1e293b",
      };
      buildingsFeatures.push(tank);
    }
  }

  // =========================================================================
  // 1. Natural Land Use: Pallikaranai Marsh, Canals, Parks & Temple Tank
  // =========================================================================

  // A. Pallikaranai Marshland Basin (South of Row 0: x: -300 to 1300, y: -220 to -45)
  const marshPolygon = rectPolygon(-300, -220, 1300, -45);
  marshPolygon.properties = {
    type: "water",
    name: "Pallikaranai Marshland Basin",
    color: "#0a1c2e",
    strokeColor: "#1d4ed8",
  };
  landuseFeatures.push(marshPolygon);

  // B. Veerangal Odai Drainage Canal (Monsoon stormwater canal: x: -250 to 1250, y: -45 to -22)
  const canalPolygon = rectPolygon(-250, -45, 1250, -22);
  canalPolygon.properties = {
    type: "canal",
    name: "Veerangal Odai Drainage Canal",
    color: "#09243d",
    strokeColor: "#2563eb",
  };
  landuseFeatures.push(canalPolygon);

  // C. Pallikaranai Wetland Buffer Greenbelt (y: -22 to -6, x: -200 to 1200)
  const marshBufferPark = rectPolygon(-200, -22, 1200, -6);
  marshBufferPark.properties = {
    type: "park",
    name: "Pallikaranai Wetland Reserve Buffer",
    color: "#0f231a",
    strokeColor: "#1b4332",
  };
  landuseFeatures.push(marshBufferPark);

  // D. Dhandeeswaram Sacred Temple Kulam (Stepped Water Tank: x: 420 to 485, y: 175 to 220)
  const templeTank = rectPolygon(420, 175, 485, 220);
  templeTank.properties = {
    type: "temple_tank",
    name: "Dhandeeswaram Temple Tank (Kulam)",
    color: "#081d33",
    strokeColor: "#d97706",
  };
  landuseFeatures.push(templeTank);

  // E. Ram Nagar Central Neighborhood Park & Playground (x: 230 to 330, y: 22 to 85)
  const ramNagarPark = rectPolygon(230, 22, 330, 85);
  ramNagarPark.properties = {
    type: "park",
    name: "Ram Nagar Children's Park & Sports Ground",
    color: "#11261c",
    strokeColor: "#165335",
  };
  landuseFeatures.push(ramNagarPark);

  // F. AGS Colony Community Garden (x: 630 to 720, y: 22 to 75)
  const agsPark = rectPolygon(630, 22, 720, 75);
  agsPark.properties = {
    type: "park",
    name: "AGS Colony Community Park",
    color: "#102319",
    strokeColor: "#165335",
  };
  landuseFeatures.push(agsPark);

  // G. Perungudi High Ground Nature Reserve (around r2c3: x: 520 to 710, y: 250 to 355)
  const perungudiHillPark = rectPolygon(520, 250, 710, 355);
  perungudiHillPark.properties = {
    type: "park",
    name: "Perungudi High Ground Nature Reserve",
    color: "#13261d",
    strokeColor: "#1b382b",
  };
  landuseFeatures.push(perungudiHillPark);

  // H. Velachery Concourse Plaza & Bus Terminus Grounds (x: 140 to 260, y: 165 to 235)
  const velacheryPlaza = rectPolygon(140, 165, 260, 235);
  velacheryPlaza.properties = {
    type: "plaza",
    name: "Velachery Concourse Plaza",
    color: "#111e19",
    strokeColor: "#1b382b",
  };
  landuseFeatures.push(velacheryPlaza);

  // I. Taramani Sports Stadium Field & Athletic Grounds (x: 1020 to 1180, y: 310 to 425)
  const taramaniStadiumGrounds = rectPolygon(1020, 310, 1180, 425);
  taramaniStadiumGrounds.properties = {
    type: "sports_ground",
    name: "Taramani Sports Complex Athletic Track",
    color: "#122a1e",
    strokeColor: "#10b981",
  };
  landuseFeatures.push(taramaniStadiumGrounds);

  // J. OMR Boulevard Center Landscaped Medians (y: 446 to 454)
  for (let c = 0; c < 5; c++) {
    const medXMin = c * 200 + 20;
    const medXMax = (c + 1) * 200 - 20;
    const median = rectPolygon(medXMin, 447, medXMax, 453);
    median.properties = {
      type: "park",
      name: "OMR Boulevard Median Green",
      color: "#143322",
      strokeColor: "#166534",
    };
    landuseFeatures.push(median);
  }

  // =========================================================================
  // 2. Dense Urban Blocks & Buildings (Core 15 Grid Blocks)
  // =========================================================================
  // Grid: 3 rows (r=0..2), 5 cols (c=0..4).
  // Inside each 200m x 150m cell, inset roads by 16m -> usable parcel: 168m x 118m.

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 5; c++) {
      const bXMin = c * 200 + 16;
      const bXMax = (c + 1) * 200 - 16;
      const bYMin = r * 150 + 16;
      const bYMax = (r + 1) * 150 - 16;

      // Urban parcel foundation plinth
      const parcel = rectPolygon(bXMin, bYMin, bXMax, bYMax);
      parcel.properties = {
        type: "urban_parcel",
        name: `Sector Block ${r + 1}-${c + 1}`,
        color: "#0c121d",
        strokeColor: "#162233",
      };
      landuseFeatures.push(parcel);

      // Check landmarks in this cell
      const isGovtSchool = r === 1 && c === 3;
      const isCommunityHall = r === 1 && c === 0;
      const isSportsComplex = r === 2 && c === 4;
      const isClinic = r === 2 && c === 3;
      const isTemple = r === 1 && c === 2;
      const isPharmacy = r === 0 && c === 0;
      const isBank = r === 2 && c === 2;

      if (isGovtSchool) {
        // --- SHELTER S1: Govt High School Campus ---
        addBuilding(bXMin + 10, bYMin + 10, bXMin + 85, bYMin + 65, 18, "Govt School (Shelter S1)", "shelter", "#1e3a45", "#06b6d4");
        addBuilding(bXMin + 70, bYMin + 68, bXMin + 140, bYMin + 106, 14, "Velachery School Assembly Hall", "shelter_wing", "#1a323c");
        addBuilding(bXMin + 92, bYMin + 12, bXMin + 155, bYMin + 58, 16, "Velachery School Science Block", "educational", "#1d3542");
        addBuilding(bXMin + 12, bYMin + 72, bXMin + 62, bYMin + 108, 12, "Govt School Library Annex", "educational", "#172b36");

        // Schoolyard trees
        addTree(bXMin + 78, bYMin + 60, 4.0, 7.5, "#15803d");
        addTree(bXMin + 148, bYMin + 80, 3.5, 7.0, "#166534");
        addTree(bXMin + 148, bYMin + 30, 3.8, 8.0, "#22c55e");
      } else if (isCommunityHall) {
        // --- SHELTER S2: Community Hall ---
        addBuilding(bXMin + 20, bYMin + 18, bXMin + 130, bYMin + 88, 17, "Community Hall (Shelter S2)", "shelter", "#1a353d", "#06b6d4");
        addBuilding(bXMin + 135, bYMin + 20, bXMin + 160, bYMin + 75, 13, "Perungudi Relief Supply Depot", "civic", "#162f36");
        addBuilding(bXMin + 22, bYMin + 92, bXMin + 90, bYMin + 112, 11, "Community Dispensary Annex", "medical", "#182f37");
        addBuilding(bXMin + 96, bYMin + 92, bXMin + 158, bYMin + 112, 12, "Civic Ward Office", "civic", "#182d36");

        addTree(bXMin + 10, bYMin + 50, 4.0, 7.5, "#15803d");
        addTree(bXMin + 145, bYMin + 95, 3.5, 7.0, "#166534");
      } else if (isSportsComplex) {
        // --- SHELTER S3: District Sports Complex ---
        addBuilding(bXMin + 12, bYMin + 14, bXMin + 148, bYMin + 92, 28, "District Sports Complex (Shelter S3)", "shelter", "#1c3d4a", "#06b6d4");
        addBuilding(bXMin + 18, bYMin + 96, bXMin + 95, bYMin + 114, 15, "Taramani Indoor Badminton Pavilion", "sports", "#18323c");
        addBuilding(bXMin + 102, bYMin + 96, bXMin + 158, bYMin + 114, 16, "Sports Academy Training Centre", "sports", "#1a3440");

        addTree(bXMin + 6, bYMin + 50, 4.2, 8.0, "#15803d");
        addTree(bXMin + 155, bYMin + 50, 4.0, 8.0, "#22c55e");
      } else if (isClinic) {
        // --- MEDICAL: Kamakshi Multi-Specialty Clinic ---
        addBuilding(bXMin + 25, bYMin + 22, bXMin + 115, bYMin + 82, 22, "Kamakshi Multi-Specialty Clinic", "medical", "#273b3e", "#10b981");
        addBuilding(bXMin + 120, bYMin + 22, bXMin + 160, bYMin + 65, 17, "Kamakshi Diagnostic Imaging Center", "medical", "#213437");
        addBuilding(bXMin + 25, bYMin + 88, bXMin + 95, bYMin + 112, 14, "Emergency Ambulance Depot", "medical", "#1e3033");
        addBuilding(bXMin + 102, bYMin + 72, bXMin + 158, bYMin + 112, 18, "Specialty Medical Suites", "commercial", "#203238");

        addTree(bXMin + 10, bYMin + 30, 3.5, 7.0, "#10b981");
        addTree(bXMin + 140, bYMin + 95, 3.5, 7.0, "#15803d");
      } else if (isTemple) {
        // --- TEMPLE: Dhandeeswaram Ancient Shiva Temple ---
        addBuilding(bXMin + 30, bYMin + 22, bXMin + 110, bYMin + 85, 25, "Dhandeeswaram Temple Complex", "temple", "#35383a", "#f59e0b");
        addBuilding(bXMin + 115, bYMin + 32, bXMin + 158, bYMin + 78, 14, "Temple Mandapam & Kitchen", "temple", "#2d3032");
        addBuilding(bXMin + 32, bYMin + 90, bXMin + 90, bYMin + 112, 10, "Temple Vahana Chariot Pavilion", "temple", "#26292b");

        // Temple Sacred Grove trees
        addTree(bXMin + 12, bYMin + 30, 4.5, 8.5, "#15803d");
        addTree(bXMin + 12, bYMin + 80, 4.0, 8.0, "#166534");
        addTree(bXMin + 135, bYMin + 95, 4.2, 8.0, "#14532d");
      } else if (isPharmacy) {
        // --- PHARMACY & RESIDENTIAL: Velachery Health Centre ---
        addBuilding(bXMin + 10, bYMin + 12, bXMin + 65, bYMin + 55, 12, "Velachery Health Centre", "commercial", "#1b2938");
        addBuilding(bXMin + 72, bYMin + 12, bXMin + 155, bYMin + 55, 20, "Ram Nagar Enclave Apartments - Wing A", "residential", "#182230");
        addBuilding(bXMin + 12, bYMin + 62, bXMin + 85, bYMin + 112, 18, "Ram Nagar Enclave Apartments - Wing B", "residential", "#192433");
        addBuilding(bXMin + 92, bYMin + 62, bXMin + 158, bYMin + 112, 22, "Ram Nagar Towers", "residential", "#1c2838");

        addTree(bXMin + 78, bYMin + 58, 3.5, 6.5, "#15803d");
      } else if (isBank) {
        // --- COMMERCIAL: Perungudi Tech Park ---
        addBuilding(bXMin + 20, bYMin + 18, bXMin + 105, bYMin + 82, 30, "Perungudi Tech Park Tower", "commercial", "#223145", "#38bdf8");
        addBuilding(bXMin + 112, bYMin + 18, bXMin + 160, bYMin + 82, 24, "Perungudi Tech Tower B", "commercial", "#1e2c3e");
        addBuilding(bXMin + 20, bYMin + 88, bXMin + 90, bYMin + 112, 16, "Tech Park Conference Pavilion", "commercial", "#1a2636");
        addBuilding(bXMin + 96, bYMin + 88, bXMin + 158, bYMin + 112, 14, "Tech Park Multi-Level Parking", "commercial", "#182332");

        addTree(bXMin + 10, bYMin + 50, 3.8, 7.5, "#15803d");
        addTree(bXMin + 104, bYMin + 50, 3.5, 7.0, "#22c55e");
      } else {
        // --- STANDARD DENSE URBAN / RESIDENTIAL BLOCK (8 to 12 Buildings) ---
        // Subdivide into 2 rows (North & South) with central access lane and courtyard trees
        const midY = (bYMin + bYMax) / 2;
        const quarterWidth = (bXMax - bXMin) / 4;

        // South Row: 4 residential/commercial buildings
        for (let i = 0; i < 4; i++) {
          const x1 = bXMin + i * quarterWidth + 4;
          const x2 = x1 + quarterWidth - 8;
          const y1 = bYMin + 6;
          const y2 = midY - 6;

          const h = 11 + Math.floor(prng() * 15);
          const isComm = (r === 1 && i % 2 === 0);
          const type = isComm ? "commercial" : "residential";
          const color = isComm ? "#1c2837" : "#172230";
          const bName = `${type === "commercial" ? "Velachery Arcade" : "Residential Flats"} ${r}${c}-${i + 1}`;

          addBuilding(x1, y1, x2, y2, h, bName, type, color);

          // Courtyard tree between buildings
          if (i === 1 || i === 2) {
            addTree((x1 + x2) / 2, midY, 3.0, 6.5, "#166534");
          }
        }

        // North Row: 4 residential/commercial buildings
        for (let i = 0; i < 4; i++) {
          const x1 = bXMin + i * quarterWidth + 4;
          const x2 = x1 + quarterWidth - 8;
          const y1 = midY + 6;
          const y2 = bYMax - 6;

          const h = 12 + Math.floor(prng() * 16);
          const isComm = (r === 2 && i % 2 === 1);
          const type = isComm ? "commercial" : "residential";
          const color = isComm ? "#1e2a3b" : "#192433";
          const bName = `${type === "commercial" ? "Corporate Plaza" : "Apartments"} ${r}${c}-${i + 5}`;

          addBuilding(x1, y1, x2, y2, h, bName, type, color);
        }
      }
    }
  }

  // =========================================================================
  // 3. Perimeter Urban Fabric (Making the City Visually Huge & Continuous)
  // =========================================================================

  // A. North Perimeter: OMR IT Expressway Corridor (y: 470 to 630m, x: -80 to 1180m)
  console.log("Generating OMR IT Corridor high-rise tech towers...");
  for (let c = 0; c < 6; c++) {
    const pXMin = c * 200 - 60;
    const pXMax = pXMin + 160;

    // Tech campus parcel
    const campus = rectPolygon(pXMin, 470, pXMax, 620);
    campus.properties = {
      type: "urban_parcel",
      name: `OMR Tech Campus ${c + 1}`,
      color: "#0b111a",
      strokeColor: "#172233",
    };
    landuseFeatures.push(campus);

    // High-Rise IT Glass Towers (heights 32m to 50m)
    const towerH1 = 34 + Math.floor(prng() * 18);
    addBuilding(pXMin + 12, 485, pXMin + 75, 550, towerH1, `OMR IT Glass Tower ${c + 1}-A`, "commercial", "#223348", "#38bdf8");

    const towerH2 = 28 + Math.floor(prng() * 16);
    addBuilding(pXMin + 85, 490, pXMax - 12, 560, towerH2, `OMR Tech Tower ${c + 1}-B`, "commercial", "#1f2e42");

    const podiumH = 14 + Math.floor(prng() * 6);
    addBuilding(pXMin + 20, 568, pXMax - 20, 612, podiumH, `Tech Campus Multi-Level Deck ${c + 1}`, "commercial", "#192535");

    // Campus boulevard trees
    addTree(pXMin + 80, 480, 4.0, 8.0, "#15803d");
    addTree(pXMin + 80, 565, 3.8, 7.5, "#22c55e");
    addTree(pXMin + 5, 550, 3.5, 7.0, "#166534");
  }

  // B. West Perimeter: Velachery West & Adambakkam Residential Sector (x: -240 to -24m)
  console.log("Generating Velachery West & Adambakkam residential settlements...");
  for (let r = 0; r < 3; r++) {
    const pYMin = r * 150 + 16;
    const pYMax = (r + 1) * 150 - 16;

    const westParcel = rectPolygon(-230, pYMin, -24, pYMax);
    westParcel.properties = {
      type: "urban_parcel",
      name: `Adambakkam Residential Block ${r + 1}`,
      color: "#0a1018",
      strokeColor: "#152030",
    };
    landuseFeatures.push(westParcel);

    // 4 to 6 residential apartment blocks per sector
    for (let i = 0; i < 4; i++) {
      const y1 = pYMin + i * 28 + 4;
      const y2 = y1 + 22;
      const h1 = 12 + Math.floor(prng() * 12);
      addBuilding(-220, y1, -130, y2, h1, `Adambakkam Colony ${r + 1}-${i * 2 + 1}`, "residential", "#17212d");

      const h2 = 14 + Math.floor(prng() * 10);
      addBuilding(-120, y1, -34, y2, h2, `Adambakkam Colony ${r + 1}-${i * 2 + 2}`, "residential", "#192432");

      addTree(-125, (y1 + y2) / 2, 3.2, 6.8, "#166534");
    }
  }

  // C. East Perimeter: Perungudi / Thoraipakkam IT & Residential (x: 1024 to 1240m)
  console.log("Generating Perungudi & Thoraipakkam eastern tech corridors...");
  for (let r = 0; r < 3; r++) {
    const pYMin = r * 150 + 16;
    const pYMax = (r + 1) * 150 - 16;

    const eastParcel = rectPolygon(1024, pYMin, 1240, pYMax);
    eastParcel.properties = {
      type: "urban_parcel",
      name: `Perungudi East Tech Block ${r + 1}`,
      color: "#0a1018",
      strokeColor: "#152030",
    };
    landuseFeatures.push(eastParcel);

    // Tech parks and residential towers
    const hA = 22 + Math.floor(prng() * 16);
    addBuilding(1034, pYMin + 10, 1126, pYMax - 10, hA, `Thoraipakkam Tech Park ${r + 1}-A`, "commercial", "#202f41", "#38bdf8");

    const hB = 26 + Math.floor(prng() * 14);
    addBuilding(1138, pYMin + 10, 1230, pYMax - 10, hB, `Thoraipakkam High-Rise ${r + 1}-B`, "residential", "#1c293a");

    addTree(1132, (pYMin + pYMax) / 2, 3.8, 7.5, "#15803d");
  }

  // =========================================================================
  // 4. City-Wide 3D Avenue & Street Trees (Over 250+ Volumetric Trees)
  // =========================================================================
  console.log("Planting city-wide 3D avenue trees, street lines and park groves...");

  // A. Velachery Main Road Boulevard (y = 150m): North & South Curbs
  for (let x = -180; x <= 1180; x += 28) {
    // South sidewalk tree
    addTree(x, 137, 3.6, 7.2, (x % 56 === 0) ? "#15803d" : "#166534");
    // North sidewalk tree
    addTree(x + 14, 163, 3.6, 7.2, (x % 56 === 0) ? "#1e7e34" : "#22c55e");
  }

  // B. Taramani Link Road Avenue (y = 300m): Curbs
  for (let x = -160; x <= 1160; x += 35) {
    addTree(x, 287, 3.5, 7.0, "#15803d");
    addTree(x + 18, 313, 3.5, 7.0, "#166534");
  }

  // C. OMR IT Expressway Corridor (y = 450m): Center Median & Curbs
  for (let x = -150; x <= 1150; x += 32) {
    // Median trees
    addTree(x, 450, 3.2, 6.5, "#22c55e");
    // North curb trees
    addTree(x + 16, 464, 3.8, 7.8, "#15803d");
  }

  // D. North-South Major Arterials (Sidewalk Trees)
  // Col 0 (x = 0), Col 1 (x = 200), Col 2 (x = 400), Col 3 (x = 600), Col 4 (x = 800), Col 5 (x = 1000)
  const northSouthAvenues = [0, 200, 400, 600, 800, 1000];
  for (const avenueX of northSouthAvenues) {
    for (let y = 15; y <= 435; y += 32) {
      if (Math.abs(y - 150) > 20 && Math.abs(y - 300) > 20) {
        addTree(avenueX - 12, y, 3.2, 6.8, "#166534");
        addTree(avenueX + 12, y + 16, 3.2, 6.8, "#15803d");
      }
    }
  }

  // E. Ram Nagar Park Grove
  for (let gx = 245; gx <= 315; gx += 22) {
    for (let gy = 32; gy <= 75; gy += 20) {
      addTree(gx, gy, 4.2, 8.2, "#15803d");
    }
  }

  // F. Perungudi High Ground Nature Forest (Dense Canopy Cluster)
  for (let px = 540; px <= 690; px += 26) {
    for (let py = 265; py <= 340; py += 24) {
      addTree(px, py, 4.6, 9.0, (px % 52 === 0) ? "#14532d" : "#15803d");
    }
  }

  // G. Pallikaranai Wetland Buffer Riparian Trees (along Canal edge)
  for (let wx = -180; wx <= 1180; wx += 35) {
    addTree(wx, -14, 4.0, 7.5, "#15803d");
    addTree(wx + 18, -10, 3.8, 7.0, "#166534");
  }

  // =========================================================================
  // 5. Output Data Files
  // =========================================================================
  const dataDir = path.join(__dirname, "../data");

  const buildingsGeoJSON = {
    type: "FeatureCollection",
    features: buildingsFeatures,
  };

  const landuseGeoJSON = {
    type: "FeatureCollection",
    features: landuseFeatures,
  };

  fs.writeFileSync(path.join(dataDir, "buildings.json"), JSON.stringify(buildingsGeoJSON, null, 2));
  fs.writeFileSync(path.join(dataDir, "landuse.json"), JSON.stringify(landuseGeoJSON, null, 2));

  console.log(`Successfully generated ${buildingsFeatures.length} 3D city features (buildings & 3D trees) in data/buildings.json`);
  console.log(`Successfully generated ${landuseFeatures.length} land-use features (wetlands, canals, parks, temple tank) in data/landuse.json`);
}

main();
