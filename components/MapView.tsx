"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import roadsGeoJSON from "@/data/roads.json";
import floodPolygonsData from "@/data/floodPolygons.json";
import sheltersData from "@/data/shelters.json";
import buildingsGeoJSON from "@/data/buildings.json";
import landuseGeoJSON from "@/data/landuse.json";
import { getGraph } from "@/lib/graph";
import { RouteResult, StandardRouteComparison } from "@/lib/routing";
import { ShelterState } from "@/lib/shelterEngine";
import { getEdgeHazardState } from "@/lib/hazardEngine";

interface MapViewProps {
  currentRoute: RouteResult;
  standardComparison: StandardRouteComparison;
  showStandardRoute: boolean;
  simulationMinute: number;
  profileId: string;
  evacueeStartJunction: string;
  shelters: Record<string, ShelterState>;
  raceProgress?: { lng: number; lat: number } | null;
  isRaceMode?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PITCH_3D = 58;
const BEARING_DEFAULT = -16;
const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY ?? "";
const MAPTILER_STYLE_URL = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${MAPTILER_KEY}`
  : null;

// Blank offline fallback style
const OFFLINE_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#070a0f" },
    },
  ],
};

// Seeded POIs to label on the map (from generate-data script landmarks)
const POI_LABELS = [
  { id: "r0c0", icon: "💊", name: "Pharmacy" },
  { id: "r1c1", icon: "🛕", name: "Velachery Temple" },
  { id: "r2c2", icon: "🏦", name: "Bank" },
  { id: "r3c3", icon: "🏥", name: "Clinic" },
  { id: "r0c3", icon: "🏫", name: "School" },
];

// ---------------------------------------------------------------------------
// Map Legend Component
// ---------------------------------------------------------------------------
function MapLegend({ bearing }: { bearing: number }) {
  const DEPTH_BANDS = [
    { color: "#1e3a8a", label: "< 0.5 m" },
    { color: "#1d4ed8", label: "0.5–1.0 m" },
    { color: "#2563eb", label: "1.0–2.0 m" },
    { color: "#3b82f6", label: "> 2.0 m" },
  ];

  // Compass arrow rotates to cancel map bearing so it points geographic north
  const compassRotation = -bearing;

  return (
    <div className="absolute bottom-10 right-3 z-20 select-none flex flex-col gap-1.5">
      {/* Compass rose */}
      <div className="flex justify-end mb-0.5">
        <div
          className="w-8 h-8 rounded-full bg-[#111620]/95 border border-slate-700/80 flex items-center justify-center shadow-lg"
          title="North"
        >
          <div
            style={{ transform: `rotate(${compassRotation}deg)` }}
            className="transition-transform duration-500 text-[16px] leading-none select-none"
          >
            🧭
          </div>
        </div>
      </div>

      {/* Legend panel */}
      <div className="bg-[#111620]/95 border border-slate-700/80 rounded-lg shadow-xl backdrop-blur-md px-3 py-2.5 min-w-[148px]">
        {/* Flood depth */}
        <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">
          Flood Depth
        </div>
        {DEPTH_BANDS.map((b) => (
          <div key={b.label} className="flex items-center gap-1.5 mb-1">
            <div
              className="w-3 h-2.5 rounded-sm flex-shrink-0"
              style={{ backgroundColor: b.color, opacity: 0.85 }}
            />
            <span className="text-[10px] font-mono text-slate-300">{b.label}</span>
          </div>
        ))}

        {/* Divider */}
        <div className="border-t border-slate-700/60 my-2" />

        {/* Route styles */}
        <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">
          Routes
        </div>
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-7 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
          <span className="text-[10px] font-mono text-slate-300">Accessible</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="w-7 h-1.5 rounded-sm flex-shrink-0"
            style={{
              background: "repeating-linear-gradient(90deg, #ef4444 0 5px, transparent 5px 9px)",
            }}
          />
          <span className="text-[10px] font-mono text-slate-300">Standard GPS</span>
        </div>

        {/* Scale bar */}
        <div className="border-t border-slate-700/60 mt-2 pt-1.5 flex items-center gap-1.5">
          <div className="flex items-end gap-0">
            <div className="w-10 border-b-2 border-l-2 border-r-2 border-slate-400 h-1.5" />
          </div>
          <span className="text-[9px] font-mono text-slate-400">≈ 200 m</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main MapView
// ---------------------------------------------------------------------------
export function MapView({
  currentRoute,
  standardComparison,
  showStandardRoute,
  simulationMinute,
  profileId,
  evacueeStartJunction,
  shelters,
  raceProgress,
  isRaceMode = false,
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [is3DMode, setIs3DMode] = useState(true);
  const [basemapFailed, setBasemapFailed] = useState(false);
  const [basemapNoticeVisible, setBasemapNoticeVisible] = useState(false);
  const [mapBearing, setMapBearing] = useState(BEARING_DEFAULT);
  // Track whether we're on offline fallback style
  const isOfflineStyleRef = useRef(false);

  const evacueeMarkerRef = useRef<maplibregl.Marker | null>(null);
  const shelterMarkersRef = useRef<maplibregl.Marker[]>([]);
  const obstacleMarkersRef = useRef<maplibregl.Marker[]>([]);
  const poiMarkersRef = useRef<maplibregl.Marker[]>([]);

  // ---------------------------------------------------------------------------
  // Helper: add all GeoJSON overlay layers on top of whatever base style loaded
  // ---------------------------------------------------------------------------
  const addOverlayLayers = useCallback((map: maplibregl.Map) => {
    const graph = getGraph();

    // ==========================================
    // A. Natural & Urban Land Use Layers
    // ==========================================
    map.addSource("landuse", {
      type: "geojson",
      data: landuseGeoJSON as any,
    });

    map.addLayer({
      id: "landuse-parcels-fill",
      type: "fill",
      source: "landuse",
      filter: ["==", ["get", "type"], "urban_parcel"],
      paint: {
        "fill-color": ["get", "color"],
        "fill-opacity": 0.85,
      },
    });

    map.addLayer({
      id: "landuse-parcels-line",
      type: "line",
      source: "landuse",
      filter: ["==", ["get", "type"], "urban_parcel"],
      paint: {
        "line-color": ["get", "strokeColor"],
        "line-width": 1.2,
        "line-opacity": 0.5,
      },
    });

    map.addLayer({
      id: "landuse-parks-fill",
      type: "fill",
      source: "landuse",
      filter: ["in", ["get", "type"], ["literal", ["park", "plaza", "sports_ground"]]],
      paint: {
        "fill-color": ["get", "color"],
        "fill-opacity": 0.9,
      },
    });

    map.addLayer({
      id: "landuse-parks-line",
      type: "line",
      source: "landuse",
      filter: ["in", ["get", "type"], ["literal", ["park", "plaza", "sports_ground"]]],
      paint: {
        "line-color": ["get", "strokeColor"],
        "line-width": 1.5,
        "line-opacity": 0.8,
      },
    });

    map.addLayer({
      id: "landuse-water-fill",
      type: "fill",
      source: "landuse",
      filter: ["in", ["get", "type"], ["literal", ["water", "canal", "temple_tank"]]],
      paint: {
        "fill-color": ["get", "color"],
        "fill-opacity": 0.95,
      },
    });

    map.addLayer({
      id: "landuse-water-line",
      type: "line",
      source: "landuse",
      filter: ["in", ["get", "type"], ["literal", ["water", "canal", "temple_tank"]]],
      paint: {
        "line-color": ["get", "strokeColor"],
        "line-width": 2,
        "line-opacity": 0.85,
      },
    });

    // ==========================================
    // B. Road Network
    // ==========================================
    map.addSource("roads-base", {
      type: "geojson",
      data: roadsGeoJSON as any,
    });

    map.addLayer({
      id: "roads-curb-casing",
      type: "line",
      source: "roads-base",
      paint: {
        "line-color": "#1e2837",
        "line-width": 10,
      },
    });

    map.addLayer({
      id: "roads-asphalt",
      type: "line",
      source: "roads-base",
      paint: {
        "line-color": "#121722",
        "line-width": 6.5,
      },
    });

    map.addLayer({
      id: "roads-centerline",
      type: "line",
      source: "roads-base",
      paint: {
        "line-color": "#28374c",
        "line-width": 1.2,
        "line-dasharray": [3, 3],
        "line-opacity": 0.7,
      },
    });

    // ==========================================
    // C. Graduated Flood Extent (4 depth bands)
    // ==========================================
    map.addSource("flood-extent", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });

    // Band fills — four layers, each filtered by depth property
    const floodBands = [
      { id: "flood-band-shallow",    minDepth: 0,   maxDepth: 0.5, color: "#1e3a8a", opacity: 0.32 },
      { id: "flood-band-moderate",   minDepth: 0.5, maxDepth: 1.0, color: "#1d4ed8", opacity: 0.44 },
      { id: "flood-band-deep",       minDepth: 1.0, maxDepth: 2.0, color: "#2563eb", opacity: 0.56 },
      { id: "flood-band-very-deep",  minDepth: 2.0, maxDepth: 99,  color: "#3b82f6", opacity: 0.68 },
    ];

    // We use a single layer with a step expression instead (simpler, works without
    // per-feature depth property — depth is injected at setData time)
    map.addLayer({
      id: "flood-extent-fill",
      type: "fill",
      source: "flood-extent",
      paint: {
        "fill-color": [
          "step",
          ["coalesce", ["get", "depth"], 0],
          "#1e3a8a",
          0.5, "#1d4ed8",
          1.0, "#2563eb",
          2.0, "#3b82f6",
        ],
        "fill-opacity": [
          "step",
          ["coalesce", ["get", "depth"], 0],
          0.32,
          0.5, 0.44,
          1.0, 0.56,
          2.0, 0.68,
        ],
      },
    });

    // Animated wavefront stroke at leading edge
    map.addLayer({
      id: "flood-extent-stroke",
      type: "line",
      source: "flood-extent",
      paint: {
        "line-color": "#60a5fa",
        "line-width": 3,
        "line-blur": 1.5,
        "line-dasharray": [4, 2],
      },
    });

    // ==========================================
    // D. Dynamic Road Hazard Colors
    // ==========================================
    map.addSource("roads-hazard", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });

    map.addLayer({
      id: "roads-hazard-line",
      type: "line",
      source: "roads-hazard",
      paint: {
        "line-color": ["get", "color"],
        "line-width": 5,
        "line-opacity": 0.9,
      },
    });

    // ==========================================
    // E. 3D Extruded Buildings — our seeded GeoJSON
    // ==========================================
    map.addSource("buildings-3d", {
      type: "geojson",
      data: buildingsGeoJSON as any,
    });

    map.addLayer({
      id: "buildings-3d-layer",
      type: "fill-extrusion",
      source: "buildings-3d",
      paint: {
        "fill-extrusion-color": ["get", "color"],
        "fill-extrusion-height": ["get", "height"],
        "fill-extrusion-base": ["get", "base_height"],
        "fill-extrusion-opacity": 0.92,
        "fill-extrusion-vertical-gradient": true,
      },
    });

    // ==========================================
    // F. Navigation Routes
    // ==========================================
    map.addSource("route-standard", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });

    map.addLayer({
      id: "route-standard-line",
      type: "line",
      source: "route-standard",
      paint: {
        "line-color": "#ef4444",
        "line-width": 4,
        "line-dasharray": [2.5, 2],
        "line-opacity": 0.9,
      },
    });

    map.addSource("route-accessible", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });

    map.addLayer({
      id: "route-accessible-glow",
      type: "line",
      source: "route-accessible",
      paint: {
        "line-color": "#10b981",
        "line-width": 14,
        "line-opacity": 0.35,
        "line-blur": 4,
      },
    });

    map.addLayer({
      id: "route-accessible-casing",
      type: "line",
      source: "route-accessible",
      paint: {
        "line-color": "#047857",
        "line-width": 7.5,
        "line-opacity": 0.95,
      },
    });

    map.addLayer({
      id: "route-accessible-line",
      type: "line",
      source: "route-accessible",
      paint: {
        "line-color": "#34d399",
        "line-width": 4.5,
        "line-opacity": 1.0,
      },
    });

    // ==========================================
    // G. Shelter Markers
    // ==========================================
    shelterMarkersRef.current = [];
    for (const s of sheltersData) {
      const jNode = graph.nodes[s.junctionId];
      if (!jNode) continue;

      const el = document.createElement("div");
      el.className = "shelter-marker-root select-none cursor-pointer";
      el.innerHTML = `
        <div class="flex flex-col items-center group">
          <div class="px-2.5 py-1 rounded-md bg-[#0c121c]/95 border border-cyan-500 shadow-xl text-[10px] font-mono text-cyan-300 flex items-center space-x-1.5 whitespace-nowrap backdrop-blur-md">
            <span class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span class="font-extrabold uppercase tracking-wide">${s.name}</span>
          </div>
          <div class="w-0.5 h-3.5 bg-gradient-to-b from-cyan-400 to-transparent"></div>
          <div class="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-lg shadow-cyan-400/50"></div>
        </div>
      `;

      const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([jNode.lng, jNode.lat])
        .addTo(map);

      shelterMarkersRef.current.push(marker);
    }

    // ==========================================
    // H. POI Label Pills
    // ==========================================
    poiMarkersRef.current = [];
    for (const poi of POI_LABELS) {
      const node = graph.nodes[poi.id];
      if (!node) continue;

      const el = document.createElement("div");
      el.className = "select-none pointer-events-none";
      el.innerHTML = `
        <div class="flex flex-col items-center">
          <div class="px-2 py-0.5 rounded-full bg-[#111620]/90 border border-slate-600/70 text-[9px] font-mono text-slate-300 flex items-center space-x-1 whitespace-nowrap shadow-md">
            <span>${poi.icon}</span>
            <span>${poi.name}</span>
          </div>
        </div>
      `;

      const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([node.lng, node.lat])
        .addTo(map);

      poiMarkersRef.current.push(marker);
    }

    // ==========================================
    // I. Obstacle Callout Annotations
    // ==========================================
    obstacleMarkersRef.current = [];
    const obstacles = [
      {
        name: "STEPS — NOT ACCESSIBLE",
        icon: "⛔",
        color: "border-rose-500/80 text-rose-300 bg-rose-950/90",
        lngLat: [graph.nodes["r1c1"]?.lng ?? 80.2138, (graph.nodes["r1c1"]?.lat ?? 12.9633) + 0.0006],
      },
      {
        name: "KERB 15cm",
        icon: "⚠️",
        color: "border-amber-500/80 text-amber-300 bg-amber-950/90",
        lngLat: [(graph.nodes["r0c1"]?.lng ?? 80.2138) + 0.0009, graph.nodes["r0c1"]?.lat ?? 12.962],
      },
      {
        name: "SLOPE 9%",
        icon: "⚠️",
        color: "border-amber-500/80 text-amber-300 bg-amber-950/90",
        lngLat: [(graph.nodes["r2c3"]?.lng ?? 80.2175) - 0.0005, graph.nodes["r2c3"]?.lat ?? 12.9647],
      },
      {
        name: "4-LANE CROSSING",
        icon: "⚠️",
        color: "border-amber-500/80 text-amber-300 bg-amber-950/90",
        lngLat: [(graph.nodes["r1c2"]?.lng ?? 80.2157) + 0.0009, graph.nodes["r1c2"]?.lat ?? 12.9633],
      },
      {
        name: "ROUGH GRAVEL",
        icon: "⚠️",
        color: "border-slate-600 text-slate-300 bg-slate-950/90",
        lngLat: [(graph.nodes["r2c0"]?.lng ?? 80.212) + 0.0009, graph.nodes["r2c0"]?.lat ?? 12.9647],
      },
    ];

    for (const obs of obstacles) {
      const el = document.createElement("div");
      el.className = "select-none pointer-events-none";
      el.innerHTML = `
        <div class="flex flex-col items-center">
          <div class="px-2 py-0.5 rounded-md border text-[9px] font-mono font-bold tracking-tight shadow-xl flex items-center space-x-1 whitespace-nowrap backdrop-blur-md ${obs.color}">
            <span>${obs.icon}</span>
            <span>${obs.name}</span>
          </div>
          <div class="w-px h-2.5 bg-slate-400/60"></div>
          <div class="w-1 h-1 rounded-full bg-slate-400"></div>
        </div>
      `;
      const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat(obs.lngLat as [number, number])
        .addTo(map);
      obstacleMarkersRef.current.push(marker);
    }

    // ==========================================
    // J. Evacuee Beacon Marker
    // ==========================================
    const evacueeEl = document.createElement("div");
    evacueeEl.className = "evacuee-marker-root select-none pointer-events-none";
    evacueeEl.innerHTML = `
      <div class="relative flex items-center justify-center">
        <div class="w-8 h-8 rounded-full bg-emerald-500/25 animate-ping absolute"></div>
        <div class="w-6 h-6 rounded-full border border-emerald-400/60 animate-pulse absolute"></div>
        <div class="w-4 h-4 rounded-full bg-emerald-400 border-2 border-white shadow-xl flex items-center justify-center text-[8px] text-slate-950 font-black">
          ●
        </div>
      </div>
    `;

    const startNode = graph.nodes[evacueeStartJunction] || Object.values(graph.nodes)[0];
    evacueeMarkerRef.current = new maplibregl.Marker({ element: evacueeEl })
      .setLngLat([startNode.lng, startNode.lat])
      .addTo(map);
  }, [evacueeStartJunction]);

  // ---------------------------------------------------------------------------
  // Helper: inject MapTiler 3D buildings layer from OpenMapTiles source
  // (only called when real basemap loaded successfully)
  // ---------------------------------------------------------------------------
  const addMapTilerBuildings = useCallback((map: maplibregl.Map) => {
    // The streets-v2-dark style bundles an OpenMapTiles source. Guard against
    // style variants where source ID differs.
    const sourceId = map.getSource("openmaptiles") ? "openmaptiles" : null;
    if (!sourceId) {
      // Try alternate source IDs used by some MapTiler style versions
      const altIds = ["maptiler_planet", "composite"];
      for (const alt of altIds) {
        if (map.getSource(alt)) {
          injectBuildingLayer(map, alt);
          return;
        }
      }
      // No known source found — skip silently
      return;
    }
    injectBuildingLayer(map, sourceId);
  }, []);

  function injectBuildingLayer(map: maplibregl.Map, sourceId: string) {
    try {
      // Insert below our first GeoJSON layer so real basemap buildings sit beneath
      map.addLayer(
        {
          id: "maptiler-buildings-3d",
          type: "fill-extrusion",
          source: sourceId,
          "source-layer": "building",
          filter: ["has", "render_height"],
          paint: {
            "fill-extrusion-color": "#111620",
            "fill-extrusion-height": [
              "coalesce",
              ["get", "render_height"],
              ["get", "height"],
              5,
            ],
            "fill-extrusion-base": [
              "coalesce",
              ["get", "render_min_height"],
              0,
            ],
            "fill-extrusion-opacity": 0.78,
            "fill-extrusion-vertical-gradient": true,
          },
        },
        "landuse-parcels-fill" // insert below our overlay layers
      );
    } catch {
      // Layer already exists or source-layer absent — skip
    }
  }

  // ---------------------------------------------------------------------------
  // 1. Initialize Map
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    let isMounted = true;

    const graph = getGraph();
    const startNode = graph.nodes[evacueeStartJunction] || Object.values(graph.nodes)[0];

    async function initMap() {
      let style: maplibregl.StyleSpecification | string = OFFLINE_STYLE;
      let usingRealBasemap = false;

      if (MAPTILER_STYLE_URL) {
        try {
          const resp = await fetch(MAPTILER_STYLE_URL);
          if (resp.ok) {
            style = MAPTILER_STYLE_URL;
            usingRealBasemap = true;
          } else {
            if (isMounted) {
              setBasemapFailed(true);
              setBasemapNoticeVisible(true);
            }
          }
        } catch {
          if (isMounted) {
            setBasemapFailed(true);
            setBasemapNoticeVisible(true);
          }
        }
      }

      if (!isMounted) return;

      isOfflineStyleRef.current = !usingRealBasemap;

      const map = new maplibregl.Map({
        container: mapContainerRef.current!,
        style,
        center: [startNode.lng + 0.0015, startNode.lat + 0.0005],
        zoom: 16.4,
        pitch: PITCH_3D,
        bearing: BEARING_DEFAULT,
        attributionControl: false,
      });

      // Track bearing for compass rose
      map.on("rotate", () => {
        if (isMounted) setMapBearing(map.getBearing());
      });

      // Navigation controls
      map.addControl(
        new maplibregl.NavigationControl({
          showCompass: true,
          visualizePitch: true,
        }),
        "top-right"
      );

      map.on("load", () => {
        if (!isMounted) return;

        try {
          (map as any).setLight({
            anchor: "viewport",
            color: "#cbd5e1",
            intensity: 0.5,
            position: [1.15, 210, 35],
          });
        } catch {}

        // If real basemap: inject MapTiler 3D buildings under our overlays
        if (usingRealBasemap) {
          addMapTilerBuildings(map);
        }

        // Add all our GeoJSON overlay layers on top
        addOverlayLayers(map);

        setIsMapLoaded(true);
      });

      // Graceful fallback: if style error fires after init (e.g. tile 401)
      map.on("error", (e: any) => {
        if (!isMounted) return;
        const msg: string = e?.error?.message ?? "";
        if (usingRealBasemap && (msg.includes("401") || msg.includes("403") || msg.includes("Failed to fetch"))) {
          // Only show notice once
          setBasemapFailed(true);
          setBasemapNoticeVisible(true);
        }
      });

      mapRef.current = map;
    }

    initMap();

    return () => {
      isMounted = false;
      shelterMarkersRef.current.forEach((m) => m.remove());
      shelterMarkersRef.current = [];
      obstacleMarkersRef.current.forEach((m) => m.remove());
      obstacleMarkersRef.current = [];
      poiMarkersRef.current.forEach((m) => m.remove());
      poiMarkersRef.current = [];
      if (evacueeMarkerRef.current) {
        evacueeMarkerRef.current.remove();
        evacueeMarkerRef.current = null;
      }
      try {
        mapRef.current?.remove();
      } catch {}
      mapRef.current = null;
      setIsMapLoaded(false);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // 2. Smooth flyTo on evacuee change
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;
    const graph = getGraph();
    const startNode = graph.nodes[evacueeStartJunction];
    if (startNode) {
      map.flyTo({
        center: [startNode.lng + 0.001, startNode.lat],
        speed: 1.2,
        curve: 1.1,
        zoom: 16.5,
        pitch: is3DMode ? PITCH_3D : 0,
        bearing: is3DMode ? BEARING_DEFAULT : 0,
        essential: true,
      });
    }
  }, [evacueeStartJunction, isMapLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // 3. Update GeoJSON overlay layers via setData (never rebuilding the map)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded || !map.isStyleLoaded()) return;
    const graph = getGraph();

    // A. Flood polygon — inject depth property from simulation minute
    const minuteFloor = Math.max(0, Math.min(30, Math.floor(simulationMinute)));
    const rawPoly = (floodPolygonsData as Record<string, any>)[String(minuteFloor)];
    const floodSrc = map.getSource("flood-extent") as maplibregl.GeoJSONSource | undefined;
    if (floodSrc && typeof floodSrc.setData === "function") {
      if (rawPoly) {
        // Inject depth property based on simulation minute so the step expression works
        const depthM = (minuteFloor * 4) / 100; // 4 cm/min → metres
        let geoData: any;
        if (rawPoly.type === "Feature") {
          geoData = {
            ...rawPoly,
            properties: { ...(rawPoly.properties ?? {}), depth: depthM },
          };
        } else if (rawPoly.type === "FeatureCollection") {
          geoData = {
            ...rawPoly,
            features: rawPoly.features.map((f: any) => ({
              ...f,
              properties: { ...(f.properties ?? {}), depth: depthM },
            })),
          };
        } else {
          geoData = rawPoly;
        }
        floodSrc.setData(geoData);
      } else {
        floodSrc.setData({ type: "FeatureCollection", features: [] });
      }
    }

    // B. Road hazard colors
    const hazardFeatures: any[] = [];
    for (const edge of graph.edges) {
      if (edge.from < edge.to) {
        const state = getEdgeHazardState(edge.id, simulationMinute, profileId);
        if (state === "threatened" || state === "impassable") {
          const fNode = graph.nodes[edge.from];
          const tNode = graph.nodes[edge.to];
          if (fNode && tNode) {
            hazardFeatures.push({
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: [
                  [fNode.lng, fNode.lat],
                  [tNode.lng, tNode.lat],
                ],
              },
              properties: {
                color: state === "impassable" ? "#ef4444" : "#f59e0b",
              },
            });
          }
        }
      }
    }
    const hazardSrc = map.getSource("roads-hazard") as maplibregl.GeoJSONSource | undefined;
    if (hazardSrc && typeof hazardSrc.setData === "function") {
      hazardSrc.setData({ type: "FeatureCollection", features: hazardFeatures });
    }

    // C. Accessible route line
    const accessibleCoords: [number, number][] = currentRoute.nodeIds
      .map((nId) => {
        const n = graph.nodes[nId];
        return n ? ([n.lng, n.lat] as [number, number]) : null;
      })
      .filter((c): c is [number, number] => c !== null);

    const accSrc = map.getSource("route-accessible") as maplibregl.GeoJSONSource | undefined;
    if (accSrc && typeof accSrc.setData === "function") {
      accSrc.setData(
        accessibleCoords.length >= 2
          ? {
              type: "Feature",
              geometry: { type: "LineString", coordinates: accessibleCoords },
              properties: {},
            }
          : { type: "FeatureCollection", features: [] }
      );
    }

    // D. Standard GPS route line
    const stdSrc = map.getSource("route-standard") as maplibregl.GeoJSONSource | undefined;
    if (stdSrc && typeof stdSrc.setData === "function") {
      if (showStandardRoute) {
        const stdCoords: [number, number][] = standardComparison.nodeIds
          .map((nId) => {
            const n = graph.nodes[nId];
            return n ? ([n.lng, n.lat] as [number, number]) : null;
          })
          .filter((c): c is [number, number] => c !== null);

        stdSrc.setData(
          stdCoords.length >= 2
            ? {
                type: "Feature",
                geometry: { type: "LineString", coordinates: stdCoords },
                properties: {},
              }
            : { type: "FeatureCollection", features: [] }
        );
      } else {
        stdSrc.setData({ type: "FeatureCollection", features: [] });
      }
    }

    // E. Shelter markers — live engine occupancy
    for (let i = 0; i < sheltersData.length; i++) {
      const s = sheltersData[i];
      const marker = shelterMarkersRef.current[i];
      const sState = shelters[s.id];
      if (marker && sState) {
        const el = marker.getElement();
        const isSelected = s.id === currentRoute.shelterId;
        const isFull = sState.isFull;

        el.innerHTML = `
          <div class="flex flex-col items-center group transition-transform ${isSelected ? "scale-105" : ""}">
            <div class="px-2.5 py-1 rounded-md border shadow-2xl text-[10px] font-mono flex items-center space-x-1.5 whitespace-nowrap transition-all ${
              isSelected
                ? "bg-cyan-950/95 border-cyan-400 text-cyan-200 ring-2 ring-cyan-400/40"
                : isFull
                ? "bg-rose-950/95 border-rose-500 text-rose-300"
                : "bg-slate-900/90 border-slate-700 text-slate-300"
            }">
              <span class="w-2 h-2 rounded-full ${
                isSelected ? "bg-cyan-400 animate-pulse" : isFull ? "bg-rose-500" : "bg-slate-500"
              }"></span>
              <span class="font-bold tracking-wide">${s.name}</span>
              <span class="text-[9px] text-slate-400 tabular-nums">(${sState.currentOccupancy}/${sState.capacity})</span>
              ${isSelected ? '<span class="px-1 bg-cyan-500/20 text-cyan-300 text-[8px] rounded font-bold">ASSIGNED</span>' : ""}
              ${isFull ? '<span class="px-1 bg-rose-800 text-white text-[8px] rounded font-bold">FULL</span>' : ""}
            </div>
            <div class="w-0.5 h-3 bg-gradient-to-b ${isSelected ? "from-cyan-400" : isFull ? "from-rose-500" : "from-slate-600"} to-transparent"></div>
            <div class="w-1.5 h-1.5 rounded-full ${isSelected ? "bg-cyan-400 shadow-md shadow-cyan-400" : isFull ? "bg-rose-500" : "bg-slate-500"}"></div>
          </div>
        `;
      }
    }
  }, [
    isMapLoaded,
    currentRoute,
    standardComparison,
    showStandardRoute,
    simulationMinute,
    profileId,
    shelters,
  ]);

  // ---------------------------------------------------------------------------
  // 4. 60fps evacuee marker movement via DOM events
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const posHandler = (e: Event) => {
      const custom = e as CustomEvent<{ lng: number; lat: number }>;
      if (evacueeMarkerRef.current && custom.detail) {
        evacueeMarkerRef.current.setLngLat([custom.detail.lng, custom.detail.lat]);
      }
    };
    const resetHandler = () => {
      const graph = getGraph();
      const startNode = graph.nodes[evacueeStartJunction];
      if (evacueeMarkerRef.current && startNode) {
        evacueeMarkerRef.current.setLngLat([startNode.lng, startNode.lat]);
      }
    };
    window.addEventListener("aegis:evacuee-pos", posHandler);
    window.addEventListener("aegis:evacuee-reset", resetHandler);
    return () => {
      window.removeEventListener("aegis:evacuee-pos", posHandler);
      window.removeEventListener("aegis:evacuee-reset", resetHandler);
    };
  }, [evacueeStartJunction]);

  useEffect(() => {
    if (!evacueeMarkerRef.current) return;
    if (raceProgress) {
      evacueeMarkerRef.current.setLngLat([raceProgress.lng, raceProgress.lat]);
    } else {
      const graph = getGraph();
      const startNode = graph.nodes[evacueeStartJunction];
      if (startNode) {
        evacueeMarkerRef.current.setLngLat([startNode.lng, startNode.lat]);
      }
    }
  }, [raceProgress, evacueeStartJunction]);

  // ---------------------------------------------------------------------------
  // 5. Frame active route in 3D camera
  // ---------------------------------------------------------------------------
  const frameRoute = useCallback(() => {
    const map = mapRef.current;
    if (!map || !currentRoute || currentRoute.nodeIds.length === 0) return;
    const graph = getGraph();
    const coords: [number, number][] = currentRoute.nodeIds
      .map((id) => {
        const n = graph.nodes[id];
        return n ? ([n.lng, n.lat] as [number, number]) : null;
      })
      .filter((c): c is [number, number] => c !== null);

    if (coords.length >= 2) {
      const lngs = coords.map((c) => c[0]);
      const lats = coords.map((c) => c[1]);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);

      map.fitBounds(
        [
          [minLng - 0.0012, minLat - 0.001],
          [maxLng + 0.0012, maxLat + 0.001],
        ],
        {
          padding: { top: 55, bottom: 65, left: 55, right: 55 },
          duration: 900,
          pitch: is3DMode ? PITCH_3D : 0,
          maxZoom: 17.0,
        }
      );
    }
  }, [currentRoute, is3DMode]);

  useEffect(() => {
    if (isRaceMode && isMapLoaded) {
      frameRoute();
    }
  }, [isRaceMode, isMapLoaded, frameRoute]);

  // ---------------------------------------------------------------------------
  // Camera controls
  // ---------------------------------------------------------------------------
  const handleToggle3D = () => {
    const map = mapRef.current;
    if (!map) return;

    if (is3DMode) {
      map.easeTo({ pitch: 0, bearing: 0, duration: 800 });
      setIs3DMode(false);
    } else {
      const graph = getGraph();
      const allLngs = Object.values(graph.nodes).map((n) => n.lng);
      const allLats = Object.values(graph.nodes).map((n) => n.lat);
      const minLng = Math.min(...allLngs);
      const maxLng = Math.max(...allLngs);
      const minLat = Math.min(...allLats);
      const maxLat = Math.max(...allLats);
      const bounds: [[number, number], [number, number]] = [
        [minLng, minLat],
        [maxLng, maxLat],
      ];
      map.fitBounds(bounds, {
        padding: { top: 75, bottom: 75, left: 75, right: 75 },
        maxZoom: 17.2,
        duration: 600,
        pitch: PITCH_3D,
        bearing: BEARING_DEFAULT,
      });
      setIs3DMode(true);
    }
  };

  const handleResetView = () => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({
      center: [80.2165, 12.9642],
      zoom: 16.3,
      pitch: is3DMode ? PITCH_3D : 0,
      bearing: is3DMode ? BEARING_DEFAULT : 0,
      duration: 700,
    });
  };

  const handleZoomIn = () => mapRef.current?.zoomIn({ duration: 300 });
  const handleZoomOut = () => mapRef.current?.zoomOut({ duration: 300 });

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="relative w-full h-full bg-[#070a0f] overflow-hidden">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Basemap unavailable notice (dismissible, one-time) */}
      {basemapNoticeVisible && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#111620]/95 border border-amber-700/60 text-[11px] font-mono text-amber-300 shadow-xl backdrop-blur-md">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
          <span>Basemap unavailable — showing schematic map. Simulation is unaffected.</span>
          <button
            onClick={() => setBasemapNoticeVisible(false)}
            className="ml-1 text-amber-400 hover:text-white transition-colors text-sm leading-none"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Map Legend */}
      <MapLegend bearing={mapBearing} />

      {/* Floating Tactical GIS Controls */}
      <div className="absolute top-3 left-3 z-20 flex items-center space-x-2 select-none">
        <div className="flex items-center rounded-lg bg-[#0c121d]/90 border border-slate-700/80 shadow-xl backdrop-blur-md p-0.5">
          <button
            onClick={handleToggle3D}
            className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold transition-all ${
              is3DMode
                ? "bg-cyan-950/80 border border-cyan-500/60 text-cyan-300 shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
            title="Toggle between 3D Isometric View and 2D Top-down View"
          >
            {is3DMode ? "3D ISO" : "2D PLAN"}
          </button>
          <button
            onClick={frameRoute}
            className="px-2.5 py-1 rounded text-[11px] font-mono text-emerald-300 hover:text-emerald-200 hover:bg-emerald-950/40 transition-all border-l border-slate-800"
            title="Auto-frame entire active evacuation route and target shelter"
          >
            FOCUS ROUTE
          </button>
          <button
            onClick={handleResetView}
            className="px-2.5 py-1 rounded text-[11px] font-mono text-slate-300 hover:text-white hover:bg-slate-800/80 transition-all border-l border-slate-800"
            title="Reset map camera to whole neighborhood view"
          >
            RESET
          </button>
          <div className="flex items-center border-l border-slate-800 pl-0.5">
            <button
              onClick={handleZoomIn}
              className="px-2 py-1 rounded text-[12px] font-mono font-bold text-slate-300 hover:text-white hover:bg-slate-800/80 transition-all"
              title="Zoom In (+)"
            >
              +
            </button>
            <button
              onClick={handleZoomOut}
              className="px-2 py-1 rounded text-[12px] font-mono font-bold text-slate-300 hover:text-white hover:bg-slate-800/80 transition-all"
              title="Zoom Out (−)"
            >
              −
            </button>
          </div>
        </div>

        <div className="hidden md:flex items-center px-2 py-1 rounded-md bg-[#0c121d]/80 border border-slate-800/80 text-[10px] font-mono text-slate-400 backdrop-blur-md">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
          <span>{basemapFailed ? "SCHEMATIC MAP // ZOOM 16.4" : "3D GIS ENGINE // ZOOM 16.4"}</span>
        </div>
      </div>
    </div>
  );
}
