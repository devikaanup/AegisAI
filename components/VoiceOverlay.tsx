"use client";

import React, { useEffect, useState } from "react";
import { aiVoice } from "@/lib/speech";

interface VoiceOverlayProps {
  isEnabled: boolean;
  onToggle: () => void;
}

export function VoiceOverlay({ isEnabled, onToggle }: VoiceOverlayProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");

  useEffect(() => {
    if (!aiVoice) return;
    aiVoice.setMuted(!isEnabled);

    const unsubscribe = aiVoice.subscribe((speaking, text) => {
      setIsSpeaking(speaking);
      if (text) {
        setTranscript(text);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isEnabled]);

  if (!isEnabled && !isSpeaking) return null;

  return (
    <div className="fixed top-14 left-1/2 -translate-x-1/2 z-40 pointer-events-auto max-w-lg w-full px-4 select-none animate-in fade-in slide-in-from-top-2 duration-200">
      <div className={`p-2.5 rounded-lg border backdrop-blur-md shadow-2xl transition-all flex items-center justify-between space-x-3 ${
        isSpeaking
          ? "bg-[#0c121d]/95 border-cyan-500/80 shadow-cyan-950/50"
          : "bg-[#0c121d]/85 border-slate-700/60"
      }`}>
        <div className="flex items-center space-x-2.5 min-w-0">
          {/* Audio Visualizer Waves */}
          <div className="flex items-end space-x-0.5 h-4 w-5 shrink-0">
            <span
              className={`w-1 rounded-full transition-all duration-150 ${
                isSpeaking
                  ? "bg-cyan-400 h-4 animate-pulse"
                  : "bg-slate-600 h-1"
              }`}
            />
            <span
              className={`w-1 rounded-full transition-all duration-200 ${
                isSpeaking
                  ? "bg-cyan-300 h-3 animate-pulse delay-75"
                  : "bg-slate-600 h-2"
              }`}
            />
            <span
              className={`w-1 rounded-full transition-all duration-100 ${
                isSpeaking
                  ? "bg-cyan-400 h-3.5 animate-pulse delay-150"
                  : "bg-slate-600 h-1"
              }`}
            />
            <span
              className={`w-1 rounded-full transition-all duration-250 ${
                isSpeaking
                  ? "bg-cyan-200 h-2 animate-pulse delay-100"
                  : "bg-slate-600 h-2.5"
              }`}
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center space-x-1.5">
              <span className="text-[9px] font-mono uppercase tracking-widest font-extrabold text-cyan-300">
                {isSpeaking ? "VOICE BROADCAST // ACTIVE" : "VOICE OVERLAY // STANDBY"}
              </span>
              <span className="text-[9px] font-mono text-slate-500">· WEB SPEECH API</span>
            </div>
            <p className="text-xs font-mono text-slate-200 truncate max-w-sm">
              {transcript || "Standby. Real-time emergency voice guidance enabled."}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 shrink-0">
          {isSpeaking && (
            <button
              onClick={() => aiVoice?.cancel()}
              className="px-2 py-0.5 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/50 text-[9px] font-mono text-cyan-200 font-bold"
              title="Silence current speech"
            >
              MUTE
            </button>
          )}
          <button
            onClick={onToggle}
            className="p-1 rounded text-slate-400 hover:text-white font-mono text-xs"
            title="Disable Voice Overlay"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
