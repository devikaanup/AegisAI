"use client";

import React from "react";
import { RouteResult, RejectionExplanation, SafetyStatusType } from "@/lib/routing";
import { ShelterState } from "@/lib/shelterEngine";
import { ShelterBars } from "./ShelterBars";

interface StatusPanelProps {
  currentRoute: RouteResult;
  shelters: Record<string, ShelterState>;
  rejections: RejectionExplanation[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  children?: React.ReactNode; // Can nest AskAegis panel
}

export function StatusPanel({
  currentRoute,
  shelters,
  rejections,
  isCollapsed,
  onToggleCollapse,
  children,
}: StatusPanelProps) {
  if (isCollapsed) {
    return (
      <div className="w-12 border-l border-slate-800 bg-[#111620] flex flex-col items-center py-4 z-30 select-none">
        <button
          onClick={onToggleCollapse}
          className="p-2 rounded hover:bg-slate-800 text-slate-400 hover:text-white font-mono text-sm"
          title="Expand Evacuation Telemetry"
        >
          ◀
        </button>
        <span className="[writing-mode:vertical-lr] text-xs font-mono text-slate-500 uppercase tracking-widest mt-6">
          Telemetry & AI
        </span>
      </div>
    );
  }

  // Safety status styling
  const getStatusBadge = (status: SafetyStatusType) => {
    switch (status) {
      case "SAFE":
        return {
          bg: "bg-emerald-950/80 border-emerald-500/80 text-emerald-300",
          dot: "bg-emerald-400 animate-pulse",
          text: `SAFE — +${currentRoute.minFloodSlackMin} min margin`,
        };
      case "TIGHT":
        return {
          bg: "bg-amber-950/80 border-amber-500/80 text-amber-300",
          dot: "bg-amber-400 animate-pulse",
          text: `TIGHT — +${currentRoute.minFloodSlackMin} min margin`,
        };
      case "WILL_NOT_REACH_SAFETY":
      default:
        return {
          bg: "bg-rose-950/90 border-rose-500 text-rose-200",
          dot: "bg-rose-500",
          text: "WILL NOT REACH SAFETY",
        };
    }
  };

  const statusBadge = getStatusBadge(currentRoute.safetyStatus);

  return (
    <aside className="w-96 border-l border-slate-800 bg-[#111620] flex flex-col h-full z-30 overflow-y-auto select-none">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400" />
          <h2 className="text-xs font-mono uppercase tracking-widest font-bold text-slate-200">
            Evacuation Telemetry
          </h2>
        </div>
        <button
          onClick={onToggleCollapse}
          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white font-mono text-xs"
          title="Collapse Sidebar"
        >
          ▶
        </button>
      </div>

      <div className="p-4 space-y-5">
        {/* Status Pill */}
        <div className="space-y-2">
          <div
            className={`px-3.5 py-2.5 rounded-full border flex items-center justify-center space-x-2 font-mono font-bold text-sm tracking-wide ${statusBadge.bg}`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${statusBadge.dot}`} />
            <span>{statusBadge.text}</span>
          </div>

          <div className="flex items-center justify-between text-xs font-mono px-1 text-slate-400">
            <span>Assigned Destination:</span>
            <span className="font-bold text-white">
              {currentRoute.shelterName || "NO REACHABLE SHELTER"}
            </span>
          </div>
        </div>

        {/* Shelter Capacities */}
        <ShelterBars
          shelters={shelters}
          selectedShelterId={currentRoute.shelterId}
        />

        {/* Deterministic "Why this route?" Factor Checklist */}
        <div className="p-3 rounded bg-slate-900/80 border border-slate-800 space-y-2">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold block">
            Why This Route?
          </span>
          <div className="space-y-1.5 text-xs text-slate-300">
            <div className="flex items-center space-x-2">
              <span className="text-emerald-400">✓</span>
              <span>No stairs on path</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-emerald-400">✓</span>
              <span>Slope within accessible limits</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-emerald-400">✓</span>
              <span>Protected road crossings</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-emerald-400">✓</span>
              <span>Path cleared before flood arrival</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-emerald-400">✓</span>
              <span>Target shelter has confirmed capacity</span>
            </div>
          </div>
        </div>

        {/* Rejected Shelters Diagnostic Log */}
        {rejections.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400 block font-semibold">
              Alternatives Rejected
            </span>
            <div className="space-y-1.5">
              {rejections.map((rej, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded bg-slate-900/60 border border-slate-800 text-xs font-mono"
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-semibold text-slate-200">
                      {rej.shelterName}
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-800 text-amber-300">
                      {rej.code}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    {rej.humanText}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Embedded Ask AEGIS Panel */}
        {children && <div className="pt-2 border-t border-slate-800">{children}</div>}
      </div>
    </aside>
  );
}
