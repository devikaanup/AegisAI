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
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40 pointer-events-auto max-w-xl w-full px-4 select-none animate-in fade-in slide-in-from-top-2 duration-200">
      <div className={`p-3 rounded-xl border backdrop-blur-md shadow-2xl transition-all flex items-center justify-between space-x-3 ${
        isSpeaking
          ? "bg-purple-950/90 border-purple-500/80 shadow-purple-950/50"
          : "bg-slate-900/85 border-slate-700/60"
      }`}>
        <div className="flex items-center space-x-3 min-w-0">
          {/* Audio Visualizer Waves */}
          <div className="flex items-end space-x-0.5 h-5 w-6 shrink-0">
            <span
              className={`w-1 rounded-full transition-all duration-150 ${
                isSpeaking
                  ? "bg-purple-400 h-5 animate-pulse"
                  : "bg-slate-500 h-1.5"
              }`}
            />
            <span
              className={`w-1 rounded-full transition-all duration-200 ${
                isSpeaking
                  ? "bg-purple-300 h-3.5 animate-pulse delay-75"
                  : "bg-slate-500 h-2.5"
              }`}
            />
            <span
              className={`w-1 rounded-full transition-all duration-100 ${
                isSpeaking
                  ? "bg-purple-400 h-4.5 animate-pulse delay-150"
                  : "bg-slate-500 h-1.5"
              }`}
            />
            <span
              className={`w-1 rounded-full transition-all duration-250 ${
                isSpeaking
                  ? "bg-purple-200 h-2.5 animate-pulse delay-100"
                  : "bg-slate-500 h-3"
              }`}
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-purple-300">
                {isSpeaking ? "AI Voice Overlay (Broadcasting)" : "AI Voice Overlay (Listening)"}
              </span>
              <span className="text-[10px] font-mono text-slate-400">· Web Speech API</span>
            </div>
            <p className="text-xs font-mono text-slate-200 truncate max-w-md">
              {transcript || "Ready. Real-time emergency voice guidance enabled."}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          {isSpeaking && (
            <button
              onClick={() => aiVoice?.cancel()}
              className="px-2 py-0.5 rounded bg-purple-900/80 hover:bg-purple-800 border border-purple-400/50 text-[10px] font-mono text-purple-200"
              title="Stop current speech"
            >
              SILENCE
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
