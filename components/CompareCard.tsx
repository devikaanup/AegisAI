"use client";

import React from "react";
import { RouteResult, StandardRouteComparison } from "@/lib/routing";

interface CompareCardProps {
  currentRoute: RouteResult;
  standardComparison: StandardRouteComparison;
  showStandardRoute: boolean;
  onToggleStandardRoute: () => void;
}

export function CompareCard({
  currentRoute,
  standardComparison,
  showStandardRoute,
  onToggleStandardRoute,
}: CompareCardProps) {
  const stdFailure =
    standardComparison.failureText ||
    (standardComparison.reachesSafety ? "Passable (Unconstrained)" : "Inaccessible");

  const slackDisplay =
    currentRoute.minFloodSlackMin === 999
      ? "Clear"
      : `+${currentRoute.minFloodSlackMin} min margin`;

  return (
    <div className="absolute top-4 right-4 z-20 w-96 rounded-lg border border-slate-700/80 bg-[#111620]/95 backdrop-blur-md p-4 shadow-2xl text-slate-100 select-none">
      {/* Header Banner */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-emerald-400 font-bold">
            ROUTE VERIFICATION
          </span>
          <h2 className="text-lg font-bold tracking-tight text-white">
            Shortest ≠ safest.
          </h2>
        </div>
        <button
          onClick={onToggleStandardRoute}
          className={`px-2 py-1 rounded text-[11px] font-mono border transition-all ${
            showStandardRoute
              ? "bg-rose-950/60 border-rose-500/70 text-rose-300"
              : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"
          }`}
        >
          {showStandardRoute ? "Hide Standard" : "Overlay Standard"}
        </button>
      </div>

      {/* Two-Column Telemetry */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* Standard Blind Route */}
        <div className="p-3 rounded bg-slate-900/80 border border-slate-800 space-y-1">
          <div className="flex items-center space-x-1.5 text-xs font-mono text-rose-400">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span className="uppercase tracking-wider font-semibold">Standard GPS</span>
          </div>
          <div className="text-[40px] font-mono font-extrabold text-white tabular-nums leading-none tracking-tight">
            {standardComparison.distanceM}
            <span className="text-sm text-slate-400 font-normal ml-0.5">m</span>
          </div>
          <div className="text-xs font-mono text-slate-300">
            {standardComparison.etaMin} min walk
          </div>
          <div className="pt-1.5 text-xs font-mono text-rose-400 border-t border-slate-800 flex items-start space-x-1">
            <span className="font-bold">✕</span>
            <span className="line-clamp-2 leading-tight">{stdFailure}</span>
          </div>
        </div>

        {/* Accessible Engine Route */}
        <div className="p-3 rounded bg-emerald-950/20 border border-emerald-500/30 space-y-1">
          <div className="flex items-center space-x-1.5 text-xs font-mono text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="uppercase tracking-wider font-semibold">Accessible Safe</span>
          </div>
          <div className="text-[40px] font-mono font-extrabold text-emerald-400 tabular-nums leading-none tracking-tight">
            {currentRoute.distanceM}
            <span className="text-sm text-emerald-400/70 font-normal ml-0.5">m</span>
          </div>
          <div className="text-xs font-mono text-slate-300">
            {currentRoute.etaMin} min safe
          </div>
          <div className="pt-1.5 text-xs font-mono text-emerald-400 border-t border-emerald-900/40 flex items-start space-x-1">
            <span className="font-bold">✓</span>
            <span className="line-clamp-2 leading-tight">
              {currentRoute.safetyStatus} · {slackDisplay}
            </span>
          </div>
        </div>
      </div>

      <div className="text-[11px] font-mono text-slate-400 text-center">
        Dijkstra multi-sink evaluation · Zero static routes
      </div>
    </div>
  );
}
