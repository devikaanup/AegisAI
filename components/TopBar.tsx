"use client";

import React from "react";

interface TopBarProps {
  simulationMinute: number;
  onOpenAiAssistant: () => void;
  onToggleRaceMode: () => void;
  isRaceModeActive: boolean;
}

export function TopBar({
  simulationMinute,
  onOpenAiAssistant,
  onToggleRaceMode,
  isRaceModeActive,
}: TopBarProps) {
  const min = Math.floor(simulationMinute);
  const sec = Math.round((simulationMinute - min) * 60);
  const timeFormatted = `T+${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;

  return (
    <header className="h-13 border-b border-[#1e293b] bg-[#070a0f] px-4 py-2 flex items-center justify-between z-40 relative select-none">
      {/* Brand & Mission Status */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-mono font-black text-white text-base tracking-widest">
            SAFEPATH
          </span>
        </div>
        <span className="text-slate-700 font-mono">/</span>
        <div className="flex items-center space-x-2">
          <span className="text-[11px] font-mono text-cyan-300 font-semibold tracking-wider hidden md:inline">
            VELACHERY–PALLIKARANAI, CHENNAI
          </span>
          <div className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-500/40 text-emerald-400 text-[10px] font-mono font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="tracking-wider">SIMULATION</span>
          </div>
        </div>
      </div>

      {/* Center Departure Timestamp */}
      <div className="flex items-center space-x-2 px-3 py-1 rounded-md bg-[#0c121d] border border-[#1e293b]">
        <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Evacuee Departs:</span>
        <span className="text-sm font-mono font-extrabold text-amber-400 tabular-nums tracking-widest">
          {timeFormatted}
        </span>
      </div>

      {/* Action Controls */}
      <div className="flex items-center space-x-2">
        {/* Talk to an AI Assistant Button */}
        <button
          onClick={onOpenAiAssistant}
          className="px-2.5 py-1 rounded text-xs font-mono flex items-center space-x-1.5 border transition-all bg-cyan-950/60 hover:bg-cyan-900/70 border-cyan-400/80 text-cyan-200 shadow-sm shadow-cyan-900/40 cursor-pointer"
          title="Open AI Disaster Evacuation Assistant"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="tracking-tight">💬 Talk to an AI Assistant</span>
        </button>

        {/* Load Demo Button */}
        <button
          onClick={onToggleRaceMode}
          className={`px-3 py-1 rounded text-xs font-mono font-bold border transition-all tracking-wider cursor-pointer ${
            isRaceModeActive
              ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-500/30"
              : "bg-emerald-950/40 hover:bg-emerald-900/50 border-emerald-600/50 text-emerald-400"
          }`}
        >
          {isRaceModeActive ? "STOP DEMO" : "⚡ LOAD DEMO"}
        </button>
      </div>
    </header>
  );
}
