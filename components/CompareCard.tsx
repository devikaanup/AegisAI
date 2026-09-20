"use client";

import React, { useState } from "react";
import { RouteResult, StandardRouteComparison } from "@/lib/routing";

interface CompareCardProps {
  currentRoute?: RouteResult;
  accessibleRoute?: RouteResult;
  standardComparison: StandardRouteComparison;
  showStandardRoute: boolean;
  onToggleStandardRoute: () => void;
  isInitiallyMinimized?: boolean;
}

export function CompareCard({
  currentRoute,
  accessibleRoute,
  standardComparison,
  showStandardRoute,
  onToggleStandardRoute,
  isInitiallyMinimized = false,
}: CompareCardProps) {
  const [isMinimized, setIsMinimized] = useState(isInitiallyMinimized);

  const route = currentRoute || accessibleRoute;
  if (!route) return null;

  const stdFailure =
    standardComparison.failureText ||
    (standardComparison.reachesSafety ? "Passable (Unconstrained)" : "Inaccessible");

  const slackDisplay =
    route.minFloodSlackMin === 999
      ? "Clear"
      : `+${route.minFloodSlackMin} min margin`;

  if (isMinimized) {
    return (
      <div className="absolute top-3 right-3 z-20 select-none">
        <button
          onClick={() => setIsMinimized(false)}
          className="px-3 py-1.5 rounded-lg border border-emerald-500/50 bg-[#0c121d]/90 backdrop-blur-md shadow-xl text-xs font-mono text-emerald-300 hover:bg-[#141e2e] hover:border-emerald-400 transition-all flex items-center space-x-2.5 group"
          title="Click to expand Route Verification card"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-extrabold tracking-wider uppercase text-[11px]">Route Audit: Shortest ≠ Safest</span>
          <span className="text-[10px] text-slate-400 font-mono bg-[#162233] px-1.5 py-0.5 rounded border border-slate-700 group-hover:text-white">
            EXPAND ▾
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="absolute top-3 right-3 z-20 w-[300px] max-w-[calc(100%-1.5rem)] rounded-xl border border-[#25354c] bg-[#0c121d]/95 backdrop-blur-md p-3 shadow-2xl text-slate-100 select-none transition-all animate-in fade-in duration-150">
      {/* Header Banner */}
      <div className="flex items-center justify-between border-b border-[#1e293b] pb-2 mb-2.5">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <div>
            <span className="text-[9px] font-mono uppercase tracking-widest text-emerald-400 font-extrabold block leading-none">
              TACTICAL ROUTE ASSESSMENT
            </span>
            <h2 className="text-sm font-extrabold tracking-tight text-white leading-tight mt-0.5">
              Shortest ≠ safest.
            </h2>
          </div>
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            onClick={onToggleStandardRoute}
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-all ${
              showStandardRoute
                ? "bg-rose-950/70 border-rose-500/80 text-rose-300"
                : "bg-[#141e2e] border-slate-700 text-slate-400 hover:text-slate-200"
            }`}
            title="Toggle standard unconstrained GPS route line on map"
          >
            {showStandardRoute ? "GPS: ON" : "GPS: OFF"}
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            className="px-2 py-0.5 rounded bg-[#141e2e] hover:bg-[#1a283d] border border-slate-700 text-slate-300 hover:text-white text-xs font-mono transition-colors"
            title="Minimize card to unblock 3D map view"
          >
            ✕ HIDE
          </button>
        </div>
      </div>

      {/* Two-Column Telemetry */}
      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        {/* Standard Blind Route */}
        <div className="p-2.5 rounded-lg bg-[#070a0f]/90 border border-rose-950/60 space-y-1">
          <div className="flex items-center space-x-1.5 text-[10px] font-mono text-rose-400">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span className="uppercase tracking-widest font-bold">Standard GPS</span>
          </div>
          <div className="text-3xl font-mono font-black text-white tabular-nums leading-none tracking-tight">
            {standardComparison.distanceM}
            <span className="text-xs text-slate-500 font-normal ml-0.5">m</span>
          </div>
          <div className="text-[11px] font-mono text-slate-400">
            {standardComparison.etaMin} min walk
          </div>
          <div className="pt-1.5 text-[10px] font-mono text-rose-400 border-t border-[#1e293b] flex items-start space-x-1">
            <span className="font-bold">✕</span>
            <span className="line-clamp-2 leading-tight">{stdFailure}</span>
          </div>
        </div>

        {/* Accessible Engine Route */}
        <div className="p-2.5 rounded-lg bg-emerald-950/25 border border-emerald-500/35 space-y-1">
          <div className="flex items-center space-x-1.5 text-[10px] font-mono text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="uppercase tracking-widest font-bold">Safe Accessible</span>
          </div>
          <div className="text-3xl font-mono font-black text-emerald-400 tabular-nums leading-none tracking-tight">
            {route.distanceM}
            <span className="text-xs text-emerald-400/70 font-normal ml-0.5">m</span>
          </div>
          <div className="text-[11px] font-mono text-slate-300">
            {route.etaMin} min safe
          </div>
          <div className="pt-1.5 text-[10px] font-mono text-emerald-400 border-t border-emerald-900/40 flex items-start space-x-1">
            <span className="font-bold">✓</span>
            <span className="line-clamp-2 leading-tight">
              {route.safetyStatus} · {slackDisplay}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 border-t border-[#1e293b] pt-2">
        <span>MULTI-SINK DIJKSTRA</span>
        <button
          onClick={() => setIsMinimized(true)}
          className="text-slate-400 hover:text-emerald-300 underline underline-offset-2"
        >
          Collapse to Map
        </button>
      </div>
    </div>
  );
}
