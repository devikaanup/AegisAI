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

// Convert local meters (x east, y north) to [lng, lat]
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

function main() {
  console.log("Generating 3D GIS city features for Riverside Heights...");

  const buildingsFeatures: any[] = [];
  const landuseFeatures: any[] = [];

  // ==========================================
  // 1. Natural Land Use: River & Parks
  // ==========================================

  // A. Palar River (Running east-west south of Row 0, from x: -100 to 1100, y: -130 to -35)
  const riverPolygon = rectPolygon(-100, -130, 1100, -35);
  riverPolygon.properties = {
    type: "water",
    name: "Palar Riverbed",
    color: "#0f233d",
    strokeColor: "#1d4ed8",
  };
  landuseFeatures.push(riverPolygon);

  // B. Riverside Greenbelt Park (between River and Riverside Rd: y: -35 to -8, x: 50 to 950)
  const riversidePark = rectPolygon(50, -32, 950, -10);
  riversidePark.properties = {
    type: "park",
    name: "Riverside Greenbelt",
    color: "#12231b",
    strokeColor: "#1b382b",
  };
  landuseFeatures.push(riversidePark);

  // C. Temple Hill Nature Sanctuary (around r2c3: x: 550 to 700, y: 260 to 340)
  const templeHillPark = rectPolygon(540, 260, 680, 340);
  templeHillPark.properties = {
    type: "park",
    name: "Temple Hill Nature Reserve",
    color: "#13261d",
    strokeColor: "#1b382b",
  };
  landuseFeatures.push(templeHillPark);

  // D. Civic Plaza & Green (near Community Hall: x: 150 to 260, y: 170 to 220)
  const civicPlaza = rectPolygon(150, 170, 260, 220);
  civicPlaza.properties = {
    type: "plaza",
    name: "Civic Plaza & Gardens",
    color: "#111e19",
    strokeColor: "#1b382b",
  };
  landuseFeatures.push(civicPlaza);

  // ==========================================
  // 2. Urban Blocks (Parcels) & 3D Buildings
  // ==========================================
  // Coarse grid has 5 column blocks (col 0 to 4, width 200m) and 3 row blocks (row 0 to 2, height 150m)
  // Inside each grid block, inset roads by 16m for asphalt roadbed + sidewalks.

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 5; c++) {
      const blockXMin = c * 200 + 18;
      const blockXMax = (c + 1) * 200 - 18;
      const blockYMin = r * 150 + 16;
      const blockYMax = (r + 1) * 150 - 16;

      // Urban parcel land use beneath buildings
      const parcel = rectPolygon(blockXMin, blockYMin, blockXMax, blockYMax);
      parcel.properties = {
        type: "urban_parcel",
        name: `Block ${r + 1}-${c + 1}`,
        color: "#0d131d",
        strokeColor: "#172233",
      };
      landuseFeatures.push(parcel);

      // Check if this block contains a landmark or shelter
      // Landmark coordinates check:
      const isGovtSchool = r === 1 && c === 3; // near r1c3 Govt High School
      const isCommunityHall = r === 1 && c === 0; // near r2c1 Community Hall
      const isSportsComplex = r === 2 && c === 4; // near r3c4 District Sports Complex
      const isClinic = r === 2 && c === 3; // near r3c3 Heights Clinic
      const isTemple = r === 1 && c === 2; // near r1c2 Ancient Temple
      const isPharmacy = r === 0 && c === 0; // near r0c1 Riverside Pharmacy
      const isBank = r === 2 && c === 2; // near r2c4 Apex Bank

      if (isGovtSchool) {
        // Govt High School Campus: Main wing (20m), East wing (14m), schoolyard
        const mainBuilding = rectPolygon(blockXMin + 12, blockYMin + 12, blockXMin + 85, blockYMin + 65);
        mainBuilding.properties = {
          name: "Govt High School (Shelter S1)",
          type: "shelter",
          height: 18,
          base_height: 0,
          color: "#1e3a45",
          highlightColor: "#06b6d4",
        };
        buildingsFeatures.push(mainBuilding);

        const eastWing = rectPolygon(blockXMin + 70, blockYMin + 65, blockXMin + 140, blockYMin + 105);
        eastWing.properties = {
          name: "Govt School Assembly Hall",
          type: "shelter_wing",
          height: 14,
          base_height: 0,
          color: "#1a323c",
        };
        buildingsFeatures.push(eastWing);

      } else if (isCommunityHall) {
        // Community Hall: Civic structure with prominent entrance pavilion
        const hall = rectPolygon(blockXMin + 25, blockYMin + 20, blockXMin + 135, blockYMin + 90);
        hall.properties = {
          name: "Community Hall (Shelter S2)",
          type: "shelter",
          height: 17,
          base_height: 0,
          color: "#1a353d",
          highlightColor: "#06b6d4",
        };
        buildingsFeatures.push(hall);

      } else if (isSportsComplex) {
        // District Sports Complex: Grand Stadium arena & indoor sports hall
        const stadium = rectPolygon(blockXMin + 15, blockYMin + 15, blockXMin + 145, blockYMin + 95);
        stadium.properties = {
          name: "District Sports Complex (Shelter S3)",
          type: "shelter",
          height: 28,
          base_height: 0,
          color: "#1c3d4a",
          highlightColor: "#06b6d4",
        };
        buildingsFeatures.push(stadium);

      } else if (isClinic) {
        // Heights Clinic: Medical Cross footprint
        const clinicMain = rectPolygon(blockXMin + 30, blockYMin + 25, blockXMin + 120, blockYMin + 85);
        clinicMain.properties = {
          name: "Heights Emergency Clinic",
          type: "medical",
          height: 22,
          base_height: 0,
          color: "#273b3e",
          highlightColor: "#10b981",
        };
        buildingsFeatures.push(clinicMain);

      } else if (isTemple) {
        // Ancient Temple on Temple Hill: Stepped temple tower
        const templeBase = rectPolygon(blockXMin + 35, blockYMin + 25, blockXMin + 115, blockYMin + 90);
        templeBase.properties = {
          name: "Ancient Temple Complex",
          type: "temple",
          height: 24,
          base_height: 0,
          color: "#35383a",
          highlightColor: "#f59e0b",
        };
        buildingsFeatures.push(templeBase);

      } else if (isPharmacy) {
        const pharmacy = rectPolygon(blockXMin + 15, blockYMin + 15, blockXMin + 70, blockYMin + 60);
        pharmacy.properties = {
          name: "Riverside Pharmacy",
          type: "commercial",
          height: 12,
          base_height: 0,
          color: "#1b2938",
        };
        buildingsFeatures.push(pharmacy);

        const residentialA = rectPolygon(blockXMin + 85, blockYMin + 20, blockXMin + 145, blockYMin + 95);
        residentialA.properties = {
          name: "Riverside Apartments",
          type: "residential",
          height: 22,
          base_height: 0,
          color: "#182230",
        };
        buildingsFeatures.push(residentialA);

      } else if (isBank) {
        const bank = rectPolygon(blockXMin + 30, blockYMin + 20, blockXMin + 110, blockYMin + 85);
        bank.properties = {
          name: "Apex Commercial Bank",
          type: "commercial",
          height: 26,
          base_height: 0,
          color: "#223145",
          highlightColor: "#38bdf8",
        };
        buildingsFeatures.push(bank);

      } else {
        // Standard Urban / Residential / Commercial block (2 to 3 subdivided buildings)
        const midX = (blockXMin + blockXMax) / 2;
        const midY = (blockYMin + blockYMax) / 2;

        const h1 = 12 + Math.floor(prng() * 18);
        const b1 = rectPolygon(blockXMin + 10, blockYMin + 10, midX - 8, midY - 6);
        b1.properties = {
          name: `Urban Complex ${r}${c}-A`,
          type: "residential",
          height: h1,
          base_height: 0,
          color: "#16202c",
        };
        buildingsFeatures.push(b1);

        const h2 = 14 + Math.floor(prng() * 16);
        const b2 = rectPolygon(midX + 8, blockYMin + 10, blockXMax - 10, midY - 6);
        b2.properties = {
          name: `Urban Complex ${r}${c}-B`,
          type: "commercial",
          height: h2,
          base_height: 0,
          color: "#1a2533",
        };
        buildingsFeatures.push(b2);

        const h3 = 10 + Math.floor(prng() * 20);
        const b3 = rectPolygon(blockXMin + 18, midY + 8, blockXMax - 18, blockYMax - 10);
        b3.properties = {
          name: `Urban Complex ${r}${c}-C`,
          type: "residential",
          height: h3,
          base_height: 0,
          color: "#182331",
        };
        buildingsFeatures.push(b3);
      }
    }
  }

  // Write out GeoJSON files
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

  console.log(`Generated ${buildingsFeatures.length} 3D buildings in data/buildings.json`);
  console.log(`Generated ${landuseFeatures.length} land-use features in data/landuse.json`);
}

main();
