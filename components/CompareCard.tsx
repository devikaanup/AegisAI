"use client";

import React, { useState } from "react";
import { RouteResult, StandardRouteComparison } from "@/lib/routing";

interface CompareCardProps {
  currentRoute: RouteResult;
  standardComparison: StandardRouteComparison;
  showStandardRoute: boolean;
  onToggleStandardRoute: () => void;
  isInitiallyMinimized?: boolean;
}

export function CompareCard({
  currentRoute,
  standardComparison,
  showStandardRoute,
  onToggleStandardRoute,
  isInitiallyMinimized = false,
}: CompareCardProps) {
  const [isMinimized, setIsMinimized] = useState(isInitiallyMinimized);

  const stdFailure =
    standardComparison.failureText ||
    (standardComparison.reachesSafety ? "Passable (Unconstrained)" : "Inaccessible");

  const slackDisplay =
    currentRoute.minFloodSlackMin === 999
      ? "Clear"
      : `+${currentRoute.minFloodSlackMin} min margin`;

  if (isMinimized) {
    return (
      <div className="absolute top-3 right-3 z-20 select-none">
        <button
          onClick={() => setIsMinimized(false)}
          className="px-3 py-1.5 rounded-lg border border-emerald-500/50 bg-[#0c111a]/85 backdrop-blur-md shadow-lg text-xs font-mono text-emerald-300 hover:bg-slate-800/90 hover:border-emerald-400 transition-all flex items-center space-x-2.5 group"
          title="Click to expand Route Verification card"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-bold tracking-tight">Route Verification: Shortest ≠ Safest</span>
          <span className="text-[10px] text-slate-400 font-mono bg-slate-800/90 px-1.5 py-0.5 rounded border border-slate-700 group-hover:text-white">
            EXPAND ▴
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="absolute top-3 right-3 z-20 w-88 max-w-sm rounded-xl border border-slate-700/80 bg-[#0c111a]/92 backdrop-blur-md p-3.5 shadow-2xl text-slate-100 select-none transition-all animate-in fade-in duration-150">
      {/* Header Banner */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold block leading-none">
              ROUTE VERIFICATION
            </span>
            <h2 className="text-sm font-bold tracking-tight text-white leading-tight">
              Shortest ≠ safest.
            </h2>
          </div>
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            onClick={onToggleStandardRoute}
            className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all ${
              showStandardRoute
                ? "bg-rose-950/60 border-rose-500/70 text-rose-300"
                : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"
            }`}
            title="Toggle standard unconstrained GPS route on map"
          >
            {showStandardRoute ? "Hide GPS" : "Show GPS"}
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            className="px-2 py-0.5 rounded bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-mono transition-colors"
            title="Minimize card to unblock map view"
          >
            ✕ HIDE
          </button>
        </div>
      </div>

      {/* Two-Column Telemetry */}
      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        {/* Standard Blind Route */}
        <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-1">
          <div className="flex items-center space-x-1.5 text-[11px] font-mono text-rose-400">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span className="uppercase tracking-wider font-semibold">Standard GPS</span>
          </div>
          <div className="text-3xl font-mono font-extrabold text-white tabular-nums leading-none tracking-tight">
            {standardComparison.distanceM}
            <span className="text-xs text-slate-400 font-normal ml-0.5">m</span>
          </div>
          <div className="text-[11px] font-mono text-slate-400">
            {standardComparison.etaMin} min walk
          </div>
          <div className="pt-1.5 text-[11px] font-mono text-rose-400 border-t border-slate-800/80 flex items-start space-x-1">
            <span className="font-bold">✕</span>
            <span className="line-clamp-2 leading-tight">{stdFailure}</span>
          </div>
        </div>

        {/* Accessible Engine Route */}
        <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/30 space-y-1">
          <div className="flex items-center space-x-1.5 text-[11px] font-mono text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="uppercase tracking-wider font-semibold">Accessible Safe</span>
          </div>
          <div className="text-3xl font-mono font-extrabold text-emerald-400 tabular-nums leading-none tracking-tight">
            {currentRoute.distanceM}
            <span className="text-xs text-emerald-400/70 font-normal ml-0.5">m</span>
          </div>
          <div className="text-[11px] font-mono text-slate-300">
            {currentRoute.etaMin} min safe
          </div>
          <div className="pt-1.5 text-[11px] font-mono text-emerald-400 border-t border-emerald-900/40 flex items-start space-x-1">
            <span className="font-bold">✓</span>
            <span className="line-clamp-2 leading-tight">
              {currentRoute.safetyStatus} · {slackDisplay}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 border-t border-slate-800/60 pt-2">
        <span>Deterministic Multi-Sink Dijkstra</span>
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
