"use client";

import React from "react";

interface TimelineProps {
  minute: number;
  onChangeMinute: (min: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playbackSpeed: number;
  onToggleSpeed: () => void;
}

export function Timeline({
  minute,
  onChangeMinute,
  isPlaying,
  onTogglePlay,
  playbackSpeed,
  onToggleSpeed,
}: TimelineProps) {
  const min = Math.floor(minute);
  const sec = Math.round((minute - min) * 60);
  const formattedTime = `T+${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;

  return (
    <div className="h-16 border-t border-[#1e293b] bg-[#070a0f] px-5 flex items-center justify-between z-40 select-none">
      {/* Play/Pause & Speed */}
      <div className="flex items-center space-x-2.5 w-44">
        <button
          onClick={onTogglePlay}
          className="w-8 h-8 rounded-md bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black flex items-center justify-center transition-all shadow-md text-xs"
          title={isPlaying ? "Pause Simulation Timeline" : "Play Simulation Timeline"}
        >
          {isPlaying ? "❚❚" : "▶"}
        </button>

        <button
          onClick={onToggleSpeed}
          className="px-2 py-1 rounded bg-[#0c121d] hover:bg-[#141d2b] border border-[#25354c] text-[10px] font-mono font-extrabold text-slate-300"
        >
          {playbackSpeed}X SPEED
        </button>
      </div>

      {/* Main Timeline Scrubber */}
      <div className="flex-1 max-w-4xl px-4 flex flex-col justify-center space-y-0.5">
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 text-[11px] uppercase tracking-wider">Departure:</span>
            <span className="font-extrabold text-amber-400 text-xs tracking-widest tabular-nums">
              {formattedTime}
            </span>
          </div>
          <div className="flex items-center space-x-3 text-[10px] text-slate-500 font-mono">
            <span>🌊 Row 0 Floods: T+04m</span>
            <span>🌊 Row 1 Impassable: T+10m</span>
            <span>🛡️ High Ground: T+30m</span>
          </div>
        </div>

        {/* Range Slider with ticks */}
        <div className="relative pt-0.5">
          <input
            type="range"
            min="0"
            max="30"
            step="0.1"
            value={minute}
            onChange={(e) => onChangeMinute(parseFloat(e.target.value))}
            className="w-full accent-cyan-400 bg-[#162233] cursor-pointer h-1.5 rounded-lg"
          />

          <div className="flex justify-between text-[9px] font-mono text-slate-500 mt-0.5">
            <span>T+00m</span>
            <span>T+05m</span>
            <span>T+10m</span>
            <span>T+15m</span>
            <span>T+20m</span>
            <span>T+25m</span>
            <span>T+30m</span>
          </div>
        </div>
      </div>

      {/* Flood Status Indicator */}
      <div className="w-44 text-right font-mono text-[11px]">
        <span className="text-slate-500 block uppercase tracking-wider text-[9px]">Flood Crest</span>
        <span className="text-cyan-400 font-bold tabular-nums">
          Depth: {Math.max(0, Math.round((minute - 4) * 4))} cm (Row 0)
        </span>
      </div>
    </div>
  );
}
