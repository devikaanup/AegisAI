"use client";

import React, { useEffect, useState, useRef } from "react";
import { aiVoice } from "@/lib/speech";

export interface DemoStep {
  caption: string;
  action: () => void;
  durationMs: number;
}

interface AutoDemoProps {
  isActive: boolean;
  onStop: () => void;
  onSelectEvacuee: (id: string) => void;
  onSelectProfile: (id: string) => void;
  onChangeMinute: (min: number) => void;
  onChangePeopleEvacuating: (n: number) => void;
  onTriggerAsk: (question: string) => void;
  onStartRaceMode: () => void;
  aiVoiceEnabled?: boolean;
}

export function AutoDemo({
  isActive,
  onStop,
  onSelectEvacuee,
  onSelectProfile,
  onChangeMinute,
  onChangePeopleEvacuating,
  onTriggerAsk,
  onStartRaceMode,
  aiVoiceEnabled = true,
}: AutoDemoProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [currentCaption, setCurrentCaption] = useState("");

  // Keep references to callbacks to avoid restarting effect on re-renders
  const callbacksRef = useRef({
    onStop,
    onSelectEvacuee,
    onSelectProfile,
    onChangeMinute,
    onChangePeopleEvacuating,
    onTriggerAsk,
    onStartRaceMode,
    aiVoiceEnabled,
  });

  useEffect(() => {
    callbacksRef.current = {
      onStop,
      onSelectEvacuee,
      onSelectProfile,
      onChangeMinute,
      onChangePeopleEvacuating,
      onTriggerAsk,
      onStartRaceMode,
      aiVoiceEnabled,
    };
  });

  const stepsRef = useRef<DemoStep[]>([
    {
      caption:
        "Step 1: Meet Marcus (Wheelchair User). Standard GPS suggests a 240m route straight into impassable Temple Steps.",
      action: () => {
        callbacksRef.current.onSelectEvacuee("marcus");
        callbacksRef.current.onSelectProfile("wheelchair");
        callbacksRef.current.onChangeMinute(0);
        callbacksRef.current.onChangePeopleEvacuating(10);
      },
      durationMs: 7000,
    },
    {
      caption:
        "Step 2: Safe Accessible Route chosen to Govt School (700m, +9.7 min slack). Asking engine: 'Why this route?'",
      action: () => {
        callbacksRef.current.onTriggerAsk("Why this route?");
      },
      durationMs: 8500,
    },
    {
      caption:
        "Step 3: Advancing departure time to T+8m. Flash flood spreads across Market St; slack tightens to 1.7 min (TIGHT).",
      action: () => {
        callbacksRef.current.onChangeMinute(8);
      },
      durationMs: 7500,
    },
    {
      caption:
        "Step 4: At T+10m, the flood cuts off the access corridor. Asking engine: 'What changed?'",
      action: () => {
        callbacksRef.current.onChangeMinute(10);
        callbacksRef.current.onTriggerAsk("What changed?");
      },
      durationMs: 8500,
    },
    {
      caption:
        "Step 5: Resetting departure to T+0m, then surging background evacuees to 50 people. Govt School saturates (50/50 FULL).",
      action: () => {
        callbacksRef.current.onChangeMinute(0);
        callbacksRef.current.onChangePeopleEvacuating(50);
      },
      durationMs: 8500,
    },
    {
      caption:
        "Step 6: Govt School is FULL! Engine automatically reroutes Marcus to Community Hall. Asking: 'Why did the shelter change?'",
      action: () => {
        callbacksRef.current.onTriggerAsk("Why did the shelter change?");
      },
      durationMs: 8500,
    },
    {
      caption:
        "Step 7: Profile Switch! Switch Marcus to Pregnant profile. Now stairs are passable with slowdown — route updates to 240m!",
      action: () => {
        callbacksRef.current.onSelectProfile("pregnant");
        callbacksRef.current.onChangePeopleEvacuating(10);
      },
      durationMs: 8000,
    },
    {
      caption:
        "Step 8: Finale — Triggering Live Race Mode! Watch citizen evacuate alongside the real-time flood front.",
      action: () => {
        callbacksRef.current.onSelectEvacuee("marcus");
        callbacksRef.current.onSelectProfile("wheelchair");
        callbacksRef.current.onChangeMinute(0);
        callbacksRef.current.onChangePeopleEvacuating(10);
        setTimeout(() => {
          callbacksRef.current.onStartRaceMode();
          callbacksRef.current.onStop();
        }, 800);
      },
      durationMs: 14000,
    },
  ]);

  useEffect(() => {
    if (!isActive) {
      setCurrentStepIndex(0);
      setCurrentCaption("");
      aiVoice?.cancel();
      return;
    }

    let timeoutId: NodeJS.Timeout;
    const steps = stepsRef.current;

    const executeStep = (idx: number) => {
      if (idx >= steps.length) {
        callbacksRef.current.onStop();
        return;
      }
      setCurrentStepIndex(idx);
      setCurrentCaption(steps[idx].caption);
      steps[idx].action();

      // Cleanly speak caption without audio pile-up
      if (callbacksRef.current.aiVoiceEnabled && aiVoice) {
        aiVoice.cancel();
        aiVoice.speak(steps[idx].caption);
      }

      timeoutId = setTimeout(() => {
        executeStep(idx + 1);
      }, steps[idx].durationMs);
    };

    // Small delay before starting first step to let UI settle
    const initialDelay = setTimeout(() => {
      executeStep(0);
    }, 400);

    return () => {
      clearTimeout(initialDelay);
      clearTimeout(timeoutId);
      aiVoice?.cancel();
    };
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-40 max-w-lg w-[calc(100%-2rem)] select-none animate-in fade-in duration-200 pointer-events-auto">
      <div className="p-3 rounded-xl border border-amber-500/70 bg-[#0c121d]/95 backdrop-blur-md shadow-2xl space-y-2 text-slate-100">
        {/* Header with step progress and controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
            <span className="text-[11px] font-mono font-bold text-amber-400 uppercase tracking-wider">
              AUTO STAGE DEMO // STEP {currentStepIndex + 1}/8
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-mono text-slate-400">
              {aiVoiceEnabled ? "🔊 Voice Active" : "🔇 Voice Muted"}
            </span>
            <button
              onClick={onStop}
              className="px-2 py-0.5 rounded bg-rose-950/80 hover:bg-rose-900 border border-rose-700 text-[10px] font-mono font-bold text-rose-200 transition-colors"
            >
              STOP [ESC]
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[#070a0f] rounded-full h-1.5 overflow-hidden border border-slate-800">
          <div
            className="bg-gradient-to-r from-amber-500 to-amber-400 h-full transition-all duration-500 rounded-full"
            style={{ width: `${((currentStepIndex + 1) / 8) * 100}%` }}
          />
        </div>

        {/* Caption */}
        <p className="text-xs font-mono text-slate-200 leading-snug font-medium">
          {currentCaption}
        </p>
      </div>
    </div>
  );
}
