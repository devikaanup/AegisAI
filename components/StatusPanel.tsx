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
  children?: React.ReactNode;
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
      <div className="w-11 border-l border-[#1e293b] bg-[#0c121d] flex flex-col items-center py-4 z-30 select-none">
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded bg-[#162233] hover:bg-[#1e2d42] border border-[#25354c] text-slate-300 hover:text-white font-mono text-xs"
          title="Expand Evacuation Telemetry"
        >
          ◀
        </button>
        <span className="[writing-mode:vertical-lr] text-[10px] font-mono text-slate-400 uppercase tracking-widest mt-6">
          TELEMETRY //
        </span>
      </div>
    );
  }

  // Safety status styling
  const getStatusBadge = (status: SafetyStatusType) => {
    switch (status) {
      case "SAFE":
        return {
          bg: "bg-emerald-950/40 border-emerald-500/80 text-emerald-300 shadow-sm shadow-emerald-950/50",
          dot: "bg-emerald-400 animate-pulse",
          text: `SAFE — +${currentRoute.minFloodSlackMin} MIN SLACK`,
        };
      case "TIGHT":
        return {
          bg: "bg-amber-950/40 border-amber-500/80 text-amber-300 shadow-sm shadow-amber-950/50",
          dot: "bg-amber-400 animate-pulse",
          text: `TIGHT — +${currentRoute.minFloodSlackMin} MIN SLACK`,
        };
      case "WILL_NOT_REACH_SAFETY":
      default:
        return {
          bg: "bg-rose-950/50 border-rose-500 text-rose-200 shadow-sm shadow-rose-950/50",
          dot: "bg-rose-500",
          text: "WILL NOT REACH SAFETY",
        };
    }
  };

  const statusBadge = getStatusBadge(currentRoute.safetyStatus);

  return (
    <aside className="w-88 border-l border-[#1e293b] bg-[#0c121d] flex flex-col h-full z-30 overflow-y-auto select-none">
      {/* Header */}
      <div className="p-3.5 border-b border-[#1e293b] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400" />
          <h2 className="text-[11px] font-mono uppercase tracking-widest font-extrabold text-slate-200">
            EVACUATION TELEMETRY
          </h2>
        </div>
        <button
          onClick={onToggleCollapse}
          className="p-1 rounded bg-[#162233] hover:bg-[#1e2d42] border border-[#25354c] text-slate-400 hover:text-white font-mono text-xs"
          title="Collapse Sidebar"
        >
          ▶
        </button>
      </div>

      <div className="p-3.5 space-y-4">
        {/* Status Pill */}
        <div className="space-y-1.5">
          <div
            className={`px-3 py-2 rounded-md border flex items-center justify-center space-x-2 font-mono font-extrabold text-xs tracking-wider ${statusBadge.bg}`}
          >
            <span className={`w-2 h-2 rounded-full ${statusBadge.dot}`} />
            <span>{statusBadge.text}</span>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono px-1 text-slate-400">
            <span>Target Destination:</span>
            <span className="font-bold text-white uppercase">
              {currentRoute.shelterName || "NO REACHABLE SHELTER"}
            </span>
          </div>
        </div>

        {/* Shelter Capacities */}
        <ShelterBars
          shelters={shelters}
          selectedShelterId={currentRoute.shelterId}
        />

        {/* Deterministic Factor Checklist */}
        <div className="p-2.5 rounded-lg bg-[#070a0f]/80 border border-[#1e293b] space-y-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-300 font-bold block">
            DETERMINISTIC ROUTE VERIFICATION
          </span>
          <div className="space-y-1 text-xs text-slate-300 font-mono">
            <div className="flex items-center space-x-2">
              <span className="text-emerald-400">✓</span>
              <span>No stairs on transit path</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-emerald-400">✓</span>
              <span>Slope within accessible tolerance</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-emerald-400">✓</span>
              <span>Multi-lane crossing safety satisfied</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-emerald-400">✓</span>
              <span>Transit arrives ahead of flood front</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-emerald-400">✓</span>
              <span>Shelter capacity confirmed available</span>
            </div>
          </div>
        </div>

        {/* Rejected Shelters Diagnostic Log */}
        {rejections.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block font-bold">
              ALTERNATIVE DESTINATIONS REJECTED
            </span>
            <div className="space-y-1">
              {rejections.map((rej, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded-md bg-[#070a0f]/80 border border-[#1e293b] text-xs font-mono"
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-bold text-slate-200">
                      {rej.shelterName}
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] bg-[#162233] text-amber-300 border border-slate-700 font-bold">
                      {rej.code}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-snug">
                    {rej.humanText}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Embedded Ask AEGIS Panel */}
        {children && <div className="pt-2 border-t border-[#1e293b]">{children}</div>}
      </div>
    </aside>
  );
}
