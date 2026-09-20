"use client";

import React, { useEffect, useRef, useState } from "react";
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
}

export function MapView({
  currentRoute,
  standardComparison,
  showStandardRoute,
  simulationMinute,
  profileId,
  evacueeStartJunction,
  shelters,
  raceProgress,
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [is3DMode, setIs3DMode] = useState(true);

  const evacueeMarkerRef = useRef<maplibregl.Marker | null>(null);
  const shelterMarkersRef = useRef<maplibregl.Marker[]>([]);
  const obstacleMarkersRef = useRef<maplibregl.Marker[]>([]);

  // 1. Initialize MapLibre with 3D Isometric View & Real-World GIS styling
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    let isMounted = true;

    const graph = getGraph();
    const startNode = graph.nodes[evacueeStartJunction] || Object.values(graph.nodes)[0];

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#070a0f" },
          },
        ],
      },
      center: [startNode.lng + 0.002, startNode.lat + 0.001],
      zoom: 15.6,
      pitch: 52,
      bearing: -16,
      attributionControl: false,
    });

    map.on("load", () => {
      if (!isMounted) return;

      // Enable 3D directional viewport light
      try {
        (map as any).setLight({
          anchor: "viewport",
          color: "#cbd5e1",
          intensity: 0.5,
          position: [1.15, 210, 35],
        });
      } catch {}

      // ==========================================
      // A. Natural & Urban Land Use Layers
      // ==========================================
      map.addSource("landuse", {
        type: "geojson",
        data: landuseGeoJSON as any,
      });

      // 1. Urban Parcels (Blocks foundation)
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

      // 2. Parks and Green Spaces
      map.addLayer({
        id: "landuse-parks-fill",
        type: "fill",
        source: "landuse",
        filter: ["in", ["get", "type"], ["literal", ["park", "plaza"]]],
        paint: {
          "fill-color": ["get", "color"],
          "fill-opacity": 0.9,
        },
      });

      map.addLayer({
        id: "landuse-parks-line",
        type: "line",
        source: "landuse",
        filter: ["in", ["get", "type"], ["literal", ["park", "plaza"]]],
        paint: {
          "line-color": ["get", "strokeColor"],
          "line-width": 1.5,
          "line-opacity": 0.8,
        },
      });

      // 3. Palar Riverbed (Water body)
      map.addLayer({
        id: "landuse-water-fill",
        type: "fill",
        source: "landuse",
        filter: ["==", ["get", "type"], "water"],
        paint: {
          "fill-color": "#0a1c30",
          "fill-opacity": 0.95,
        },
      });

      map.addLayer({
        id: "landuse-water-line",
        type: "line",
        source: "landuse",
        filter: ["==", ["get", "type"], "water"],
        paint: {
          "line-color": "#1e40af",
          "line-width": 2,
          "line-opacity": 0.8,
        },
      });

      // ==========================================
      // B. Realistic Road Network Layers
      // ==========================================
      map.addSource("roads-base", {
        type: "geojson",
        data: roadsGeoJSON as any,
      });

      // Sidewalk Curbs / Roadbed casing
      map.addLayer({
        id: "roads-curb-casing",
        type: "line",
        source: "roads-base",
        paint: {
          "line-color": "#1e2837",
          "line-width": 10,
        },
      });

      // Asphalt Pavement
      map.addLayer({
        id: "roads-asphalt",
        type: "line",
        source: "roads-base",
        paint: {
          "line-color": "#121722",
          "line-width": 6.5,
        },
      });

      // Road Dashed Centerlines
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
      // C. Precomputed Flood Extent Surface
      // ==========================================
      map.addSource("flood-extent", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "flood-extent-fill",
        type: "fill",
        source: "flood-extent",
        paint: {
          "fill-color": "#1e40af",
          "fill-opacity": 0.45,
        },
      });

      map.addLayer({
        id: "flood-extent-stroke",
        type: "line",
        source: "flood-extent",
        paint: {
          "line-color": "#60a5fa",
          "line-width": 2.5,
          "line-blur": 1,
        },
      });

      // ==========================================
      // D. Dynamic Road Hazard Colors (Threatened/Impassable)
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
      // E. 3D Extruded Buildings (fill-extrusion)
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
      // Standard Route (Dashed Red)
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

      // Accessible Safe Route (Glowing Emerald Pipeline)
      map.addSource("route-accessible", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      // 1. Ground halo glow
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

      // 2. Outer pipeline casing
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

      // 3. Neon Core
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
      // G. 3D Elevation POI Markers: Shelters
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
      // H. Anchored Obstacle Callout Annotations
      // ==========================================
      obstacleMarkersRef.current = [];
      const obstacles = [
        {
          name: "STEPS — NOT ACCESSIBLE",
          icon: "⛔",
          color: "border-rose-500/80 text-rose-300 bg-rose-950/90",
          lngLat: [graph.nodes["r1c1"]?.lng ?? 79.1538, (graph.nodes["r1c1"]?.lat ?? 12.9693) + 0.0006],
        },
        {
          name: "KERB 15cm",
          icon: "⚠️",
          color: "border-amber-500/80 text-amber-300 bg-amber-950/90",
          lngLat: [(graph.nodes["r0c1"]?.lng ?? 79.1538) + 0.0009, graph.nodes["r0c1"]?.lat ?? 12.968],
        },
        {
          name: "SLOPE 9%",
          icon: "⚠️",
          color: "border-amber-500/80 text-amber-300 bg-amber-950/90",
          lngLat: [(graph.nodes["r2c3"]?.lng ?? 79.1575) - 0.0005, graph.nodes["r2c3"]?.lat ?? 12.9707],
        },
        {
          name: "4-LANE CROSSING",
          icon: "⚠️",
          color: "border-amber-500/80 text-amber-300 bg-amber-950/90",
          lngLat: [(graph.nodes["r1c2"]?.lng ?? 79.1557) + 0.0009, graph.nodes["r1c2"]?.lat ?? 12.9693],
        },
        {
          name: "ROUGH GRAVEL",
          icon: "⚠️",
          color: "border-slate-600 text-slate-300 bg-slate-950/90",
          lngLat: [(graph.nodes["r2c0"]?.lng ?? 79.152) + 0.0009, graph.nodes["r2c0"]?.lat ?? 12.9707],
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
      // I. Evacuee Tactical Radar Beacon Marker
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

      evacueeMarkerRef.current = new maplibregl.Marker({ element: evacueeEl })
        .setLngLat([startNode.lng, startNode.lat])
        .addTo(map);

      setIsMapLoaded(true);
    });

    mapRef.current = map;

    return () => {
      isMounted = false;
      shelterMarkersRef.current.forEach((m) => m.remove());
      shelterMarkersRef.current = [];
      obstacleMarkersRef.current.forEach((m) => m.remove());
      obstacleMarkersRef.current = [];
      if (evacueeMarkerRef.current) {
        evacueeMarkerRef.current.remove();
        evacueeMarkerRef.current = null;
      }

      try {
        map.remove();
      } catch {}
      mapRef.current = null;
      setIsMapLoaded(false);
    };
  }, []);

  // 2. Smooth flyTo on evacuee change
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
      });
    }
  }, [evacueeStartJunction, isMapLoaded]);

  // 3. Update Map Layers via .setData() ONLY
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded || !map.isStyleLoaded()) return;
    const graph = getGraph();

    // A. Update Precomputed Flood Polygon
    const minuteFloor = Math.max(0, Math.min(30, Math.floor(simulationMinute)));
    const poly = (floodPolygonsData as Record<string, any>)[String(minuteFloor)];
    const floodSrc = map.getSource("flood-extent") as maplibregl.GeoJSONSource | undefined;
    if (floodSrc && typeof floodSrc.setData === "function") {
      floodSrc.setData(poly || { type: "FeatureCollection", features: [] });
    }

    // B. Update Dynamic Road Hazard Colors (Threatened/Impassable)
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

    // C. Update Accessible Route Line
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

    // D. Update Standard Route Line
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

    // E. Update Shelter Marker status labels & occupancy meters
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

  // 4. Dedicated lightweight effect for smooth 60fps evacuee marker movement
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

  // Camera Mode Toggles
  const handleToggle3D = () => {
    const map = mapRef.current;
    if (!map) return;

    if (is3DMode) {
      map.easeTo({ pitch: 0, bearing: 0, duration: 800 });
      setIs3DMode(false);
    } else {
      map.easeTo({ pitch: 52, bearing: -16, duration: 800 });
      setIs3DMode(true);
    }
  };

  const handleResetView = () => {
    const map = mapRef.current;
    if (!map) return;
    const graph = getGraph();
    const allLngs = Object.values(graph.nodes).map((n) => n.lng);
    const allLats = Object.values(graph.nodes).map((n) => n.lat);
    const minLng = Math.min(...allLngs);
    const maxLng = Math.max(...allLngs);
    const minLat = Math.min(...allLats);
    const maxLat = Math.max(...allLats);

    map.fitBounds(
      [
        [minLng - 0.001, minLat - 0.001],
        [maxLng + 0.001, maxLat + 0.001],
      ],
      { padding: 45, duration: 600, pitch: is3DMode ? 50 : 0 }
    );
  };

  return (
    <div className="relative w-full h-full bg-[#070a0f] overflow-hidden">
      <div ref={mapContainerRef} className="w-full h-full" />

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
            onClick={handleResetView}
            className="px-2.5 py-1 rounded text-[11px] font-mono text-slate-300 hover:text-white hover:bg-slate-800/80 transition-all flex items-center space-x-1"
            title="Reset map camera to whole neighborhood bounds"
          >
            <span>⤢</span>
            <span>BOUNDS</span>
          </button>
        </div>

        <div className="hidden md:flex items-center px-2 py-1 rounded-md bg-[#0c121d]/80 border border-slate-800/80 text-[10px] font-mono text-slate-400 backdrop-blur-md">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
          <span>3D GIS ENGINE // PITCH 52°</span>
        </div>
      </div>
    </div>
  );
}
