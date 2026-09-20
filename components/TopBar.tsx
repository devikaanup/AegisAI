"use client";

import React from "react";

interface TopBarProps {
  simulationMinute: number;
  aiNarrationEnabled: boolean;
  onToggleAiNarration: () => void;
  onStartAutoDemo: () => void;
  isAutoDemoActive: boolean;
  onToggleRaceMode: () => void;
  isRaceModeActive: boolean;
}

export function TopBar({
  simulationMinute,
  aiNarrationEnabled,
  onToggleAiNarration,
  onStartAutoDemo,
  isAutoDemoActive,
  onToggleRaceMode,
  isRaceModeActive,
}: TopBarProps) {
  const min = Math.floor(simulationMinute);
  const sec = Math.round((simulationMinute - min) * 60);
  const timeFormatted = `T+${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;

  return (
    <header className="h-14 border-b border-slate-800 bg-[#0a0d12] px-4 flex items-center justify-between z-40 relative select-none">
      {/* Brand & System Status */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <span className="font-mono font-extrabold text-white text-lg tracking-wider">
            AEGIS AI
          </span>
        </div>
        <span className="text-slate-600 font-mono">|</span>
        <span className="text-xs font-mono text-slate-400 uppercase tracking-widest hidden sm:inline">
          EOC Dispatch
        </span>
        <span className="text-slate-600 font-mono hidden sm:inline">|</span>
        <div className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>LIVE SIMULATION</span>
        </div>
      </div>

      {/* Center Departure Timestamp */}
      <div className="flex items-center space-x-2 px-3 py-1 rounded bg-slate-900 border border-slate-800">
        <span className="text-xs font-mono text-slate-400">Evacuee departs at:</span>
        <span className="text-sm font-mono font-bold text-amber-400 tabular-nums tracking-wider">
          {timeFormatted}
        </span>
      </div>

      {/* Action Controls */}
      <div className="flex items-center space-x-2.5">
        {/* AI Narration Toggle */}
        <button
          onClick={onToggleAiNarration}
          className={`px-2.5 py-1 rounded text-xs font-mono flex items-center space-x-1.5 border transition-all ${
            aiNarrationEnabled
              ? "bg-purple-950/40 border-purple-500/50 text-purple-300"
              : "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300"
          }`}
          title="Toggle Gemini NL event auto-narration"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              aiNarrationEnabled ? "bg-purple-400 animate-pulse" : "bg-slate-600"
            }`}
          />
          <span>AI Narration: {aiNarrationEnabled ? "ON" : "OFF"}</span>
        </button>

        {/* Auto Demo Button */}
        <button
          onClick={onStartAutoDemo}
          className={`px-3 py-1 rounded text-xs font-mono font-semibold border transition-all ${
            isAutoDemoActive
              ? "bg-amber-500 text-slate-950 border-amber-400 animate-pulse"
              : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200"
          }`}
        >
          {isAutoDemoActive ? "STOP DEMO" : "2-MIN STAGE DEMO"}
        </button>

        {/* Race Mode Button */}
        <button
          onClick={onToggleRaceMode}
          className={`px-3 py-1 rounded text-xs font-mono font-semibold border transition-all ${
            isRaceModeActive
              ? "bg-emerald-500 text-slate-950 border-emerald-400"
              : "bg-emerald-950/40 hover:bg-emerald-900/40 border-emerald-600/50 text-emerald-400"
          }`}
        >
          {isRaceModeActive ? "STOP RACE" : "⚡ RACE MODE"}
        </button>
      </div>
    </header>
  );
}
