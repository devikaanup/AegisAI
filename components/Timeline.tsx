"use client";

import React, { useEffect, useRef } from "react";

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

  // Playback loop
  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isPlaying) {
      lastTimeRef.current = null;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      return;
    }

    const animate = (now: number) => {
      if (lastTimeRef.current !== null) {
        const deltaSec = (now - lastTimeRef.current) / 1000;
        // 1 sim-minute per real second * speed
        const nextMin = minute + deltaSec * playbackSpeed;
        if (nextMin >= 30) {
          onChangeMinute(30);
          onTogglePlay();
          return;
        } else {
          onChangeMinute(nextMin);
        }
      }
      lastTimeRef.current = now;
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, playbackSpeed, minute, onChangeMinute, onTogglePlay]);

  return (
    <div className="h-20 border-t border-slate-800 bg-[#0a0d12] px-6 flex items-center justify-between z-40 select-none">
      {/* Play/Pause & Speed */}
      <div className="flex items-center space-x-3 w-48">
        <button
          onClick={onTogglePlay}
          className="w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold flex items-center justify-center transition-all shadow-md"
          title={isPlaying ? "Pause Timeline" : "Play Timeline"}
        >
          {isPlaying ? "❚❚" : "▶"}
        </button>

        <button
          onClick={onToggleSpeed}
          className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono font-bold text-slate-300"
        >
          {playbackSpeed}x SPEED
        </button>
      </div>

      {/* Main Timeline Scrubber */}
      <div className="flex-1 max-w-4xl px-6 flex flex-col justify-center space-y-1">
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400">Timeline:</span>
            <span className="font-bold text-amber-400 text-sm tracking-wider tabular-nums">
              Evacuee departs at {formattedTime}
            </span>
          </div>
          <div className="flex items-center space-x-3 text-[11px] text-slate-500">
            <span>🌊 Row 0 Floods: T+04m</span>
            <span>🌊 Row 1 Floods: T+10m</span>
            <span>🌊 Ridge Safe: T+30m</span>
          </div>
        </div>

        {/* Range Slider with ticks */}
        <div className="relative pt-1">
          <input
            type="range"
            min="0"
            max="30"
            step="0.1"
            value={minute}
            onChange={(e) => onChangeMinute(parseFloat(e.target.value))}
            className="w-full accent-emerald-400 bg-slate-800 cursor-pointer h-2 rounded-lg"
          />

          <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
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

      {/* Flood Status indicator */}
      <div className="w-48 text-right font-mono text-xs">
        <span className="text-slate-500 block">Hazard Extent</span>
        <span className="text-blue-400 font-bold tabular-nums">
          Depth: {Math.max(0, Math.round((minute - 4) * 4))} cm (Row 0)
        </span>
      </div>
    </div>
  );
}
