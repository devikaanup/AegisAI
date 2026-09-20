"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  runSimulation,
  SimulationInputs,
  SimulationState,
  SimulationEvent,
} from "@/lib/simulation";
import { buildExplanationContext } from "@/lib/explainContext";
import { composeFallbackForEvent } from "@/lib/fallbackExplanations";
import { aiVoice } from "@/lib/speech";
import { Intro } from "@/components/Intro";
import { TopBar } from "@/components/TopBar";
import { MapView } from "@/components/MapView";
import { CompareCard } from "@/components/CompareCard";
import { ControlPanel } from "@/components/ControlPanel";
import { StatusPanel } from "@/components/StatusPanel";
import { AskAegis } from "@/components/AskAegis";
import { Timeline } from "@/components/Timeline";
import { NoSafeEvacuationOverlay } from "@/components/NoSafeEvacuationOverlay";
import { Toasts, ToastItem } from "@/components/Toasts";
import { AutoDemo } from "@/components/AutoDemo";
import { RaceMode } from "@/components/RaceMode";
import { VoiceOverlay } from "@/components/VoiceOverlay";

export default function Home() {
  const [showIntro, setShowIntro] = useState(true);

  // Simulation Inputs
  const [inputs, setInputs] = useState<SimulationInputs>({
    evacueeId: "marcus",
    profileId: "wheelchair",
    simulationMinute: 0,
    peopleEvacuating: 10,
  });

  const [previousInputs, setPreviousInputs] = useState<SimulationInputs | null>(null);
  const [prevState, setPrevState] = useState<SimulationState | null>(null);

  // UI States
  const [showStandardRoute, setShowStandardRoute] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [aiNarrationEnabled, setAiNarrationEnabled] = useState(false);
  const [aiVoiceEnabled, setAiVoiceEnabled] = useState(true);
  const [isAutoDemoActive, setIsAutoDemoActive] = useState(false);
  const [isRaceModeActive, setIsRaceModeActive] = useState(false);
  const [raceProgress, setRaceProgress] = useState<{ lng: number; lat: number } | null>(null);
  const [committedRoute, setCommittedRoute] = useState<any>(null);

  // AutoDemo question trigger for Ask AEGIS
  const [externalAskQuery, setExternalAskQuery] = useState<string | null>(null);

  // Sidebars collapse
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Check API key availability on mount
  useEffect(() => {
    fetch("/api/explain")
      .then((res) => res.json())
      .then((data) => {
        if (data.hasKey) {
          setAiNarrationEnabled(true);
        }
      })
      .catch(() => {});
  }, []);

  // Compute simulation state
  const simulationState = useMemo(() => {
    return runSimulation(inputs, prevState);
  }, [inputs, prevState]);

  // Update previous inputs / state ref
  const updateInputs = useCallback((newInputs: Partial<SimulationInputs>) => {
    setInputs((curr) => {
      setPreviousInputs({ ...curr });
      return { ...curr, ...newInputs };
    });
  }, []);

  // Timeline playback loop
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setInputs((curr) => {
        const next = curr.simulationMinute + 0.25 * playbackSpeed;
        if (next >= 30) {
          setIsPlaying(false);
          return { ...curr, simulationMinute: 30 };
        }
        return { ...curr, simulationMinute: Number(next.toFixed(1)) };
      });
    }, 250);

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed]);

  // AI Narration throttle and debounce timers
  const lastNarrationTimeRef = useRef<number>(0);
  const scrubDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Event narration & voice broadcast effect
  useEffect(() => {
    if (simulationState.events.length === 0) return;
    const latestEvent = simulationState.events[simulationState.events.length - 1];
    if (!latestEvent) return;

    // Filter out simple recalculated if not accompanied by significant change
    if (latestEvent.type === "ROUTE_RECALCULATED") return;

    const deterministicText = composeFallbackForEvent(latestEvent);
    const toastId = `toast_${latestEvent.id}_${Date.now()}`;

    // Add deterministic toast immediately
    setToasts((prev) => [
      ...prev.slice(-3),
      {
        id: toastId,
        type: latestEvent.type,
        text: deterministicText,
        source: "verified",
        timestamp: Date.now(),
      },
    ]);

    // Spoken broadcast when voice is active and demo is not taking precedence
    if (aiVoiceEnabled && !isAutoDemoActive) {
      if (
        latestEvent.type === "NO_SAFE_ROUTE" ||
        latestEvent.type === "ROUTE_BLOCKED" ||
        latestEvent.type === "SHELTER_FULL" ||
        latestEvent.type === "SHELTER_CHANGED"
      ) {
        aiVoice?.speak(deterministicText);
      }
    }

    // If AI narration is enabled, debounce and throttle AI upgrade
    if (aiNarrationEnabled) {
      if (scrubDebounceTimerRef.current) {
        clearTimeout(scrubDebounceTimerRef.current);
      }

      scrubDebounceTimerRef.current = setTimeout(async () => {
        const now = Date.now();
        if (now - lastNarrationTimeRef.current < 3000) {
          return;
        }
        lastNarrationTimeRef.current = now;

        try {
          const res = await fetch("/api/explain", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question: `Explain this emergency event: ${latestEvent.type} at minute ${latestEvent.minute}`,
              inputs: {
                evacueeId: inputs.evacueeId,
                profile: inputs.profileId,
                minute: inputs.simulationMinute,
                peopleEvacuating: inputs.peopleEvacuating,
              },
              previousInputs: previousInputs
                ? {
                    evacueeId: previousInputs.evacueeId,
                    profile: previousInputs.profileId,
                    minute: previousInputs.simulationMinute,
                    peopleEvacuating: previousInputs.peopleEvacuating,
                  }
                : undefined,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            if (data.source === "gemini" && data.text) {
              setToasts((prev) =>
                prev.map((t) =>
                  t.id === toastId
                    ? { ...t, text: data.text, source: "gemini" }
                    : t
                )
              );
              if (aiVoiceEnabled && !isAutoDemoActive) {
                aiVoice?.speak(data.text);
              }
            }
          }
        } catch {
          // Maintain deterministic text
        }
      }, 700);
    }
  }, [simulationState.events, aiNarrationEnabled, aiVoiceEnabled, isAutoDemoActive, inputs, previousInputs]);

  // Clean old toasts after 7 seconds
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, 7000);
    return () => clearTimeout(timer);
  }, [toasts]);

  // Explanation context for Ask AEGIS
  const explanationContext = useMemo(() => {
    return buildExplanationContext(inputs, previousInputs);
  }, [inputs, previousInputs]);

  // Race Mode toggle: commit route at departure
  const [raceDepartureMinute, setRaceDepartureMinute] = useState<number>(0);

  const handleToggleRaceMode = () => {
    if (isRaceModeActive) {
      setIsRaceModeActive(false);
      setRaceProgress(null);
    } else {
      setCommittedRoute(simulationState.currentRoute);
      setRaceDepartureMinute(inputs.simulationMinute);
      setIsRaceModeActive(true);
    }
  };

  const handleStartRaceMode = useCallback(() => {
    setCommittedRoute(simulationState.currentRoute);
    setRaceDepartureMinute(inputs.simulationMinute);
    setIsRaceModeActive(true);
  }, [simulationState.currentRoute, inputs.simulationMinute]);

  const handleTriggerAsk = useCallback((question: string) => {
    setExternalAskQuery(question);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0a0d12] text-slate-100 overflow-hidden font-sans select-none">
      {/* 1. Intro Screen Overlay */}
      {showIntro && <Intro onStart={() => setShowIntro(false)} />}

      {/* 2. Top Bar */}
      <TopBar
        simulationMinute={inputs.simulationMinute}
        aiNarrationEnabled={aiNarrationEnabled}
        onToggleAiNarration={() => setAiNarrationEnabled(!aiNarrationEnabled)}
        aiVoiceEnabled={aiVoiceEnabled}
        onToggleAiVoice={() => setAiVoiceEnabled(!aiVoiceEnabled)}
        onStartAutoDemo={() => setIsAutoDemoActive(!isAutoDemoActive)}
        isAutoDemoActive={isAutoDemoActive}
        onToggleRaceMode={handleToggleRaceMode}
        isRaceModeActive={isRaceModeActive}
      />

      {/* 3. Floating AI Voice Overlay HUD */}
      <VoiceOverlay
        isEnabled={aiVoiceEnabled}
        onToggle={() => setAiVoiceEnabled(false)}
      />

      {/* 4. Main Console Workspace */}
      <main className="flex-1 flex relative overflow-hidden h-[calc(100vh-3.5rem-5rem)]">
        {/* Left Sidebar: Mission Setup */}
        <ControlPanel
          selectedEvacueeId={inputs.evacueeId}
          onSelectEvacuee={(id) => updateInputs({ evacueeId: id })}
          selectedProfileId={inputs.profileId}
          onSelectProfile={(id) => updateInputs({ profileId: id })}
          currentProfile={simulationState.profile}
          peopleEvacuating={inputs.peopleEvacuating}
          onChangePeopleEvacuating={(n) => updateInputs({ peopleEvacuating: n })}
          unassignedCount={simulationState.unassignedCount}
          isCollapsed={isLeftCollapsed}
          onToggleCollapse={() => setIsLeftCollapsed(!isLeftCollapsed)}
        />

        {/* Center: Offline Map Console */}
        <div className="flex-1 relative h-full bg-[#0a0d12]">
          <MapView
            currentRoute={simulationState.currentRoute}
            standardComparison={simulationState.standardComparison}
            showStandardRoute={showStandardRoute}
            simulationMinute={inputs.simulationMinute}
            profileId={inputs.profileId}
            evacueeStartJunction={simulationState.evacuee.startJunction}
            shelters={simulationState.shelters}
            raceProgress={raceProgress}
          />

          {/* Floating Compare Card - Collapsible to avoid blocking map */}
          <CompareCard
            currentRoute={simulationState.currentRoute}
            standardComparison={simulationState.standardComparison}
            showStandardRoute={showStandardRoute}
            onToggleStandardRoute={() => setShowStandardRoute(!showStandardRoute)}
          />

          {/* Race Mode Overlay Component */}
          <RaceMode
            isActive={isRaceModeActive}
            onStop={() => {
              setIsRaceModeActive(false);
              setRaceProgress(null);
            }}
            committedRoute={committedRoute || simulationState.currentRoute}
            profile={simulationState.profile}
            departureMinute={raceDepartureMinute}
            onUpdateEvacueePosition={setRaceProgress}
            onAdvanceSimulationMinute={(min) => updateInputs({ simulationMinute: min })}
            aiVoiceEnabled={aiVoiceEnabled}
          />

          {/* Auto Demo Component */}
          <AutoDemo
            isActive={isAutoDemoActive}
            onStop={() => setIsAutoDemoActive(false)}
            onSelectEvacuee={(id) => updateInputs({ evacueeId: id })}
            onSelectProfile={(id) => updateInputs({ profileId: id })}
            onChangeMinute={(min) => updateInputs({ simulationMinute: min })}
            onChangePeopleEvacuating={(n) => updateInputs({ peopleEvacuating: n })}
            onTriggerAsk={handleTriggerAsk}
            onStartRaceMode={handleStartRaceMode}
            aiVoiceEnabled={aiVoiceEnabled}
          />
        </div>

        {/* Right Sidebar: Telemetry & Explanation */}
        <StatusPanel
          currentRoute={simulationState.currentRoute}
          shelters={simulationState.shelters}
          rejections={simulationState.rejections}
          isCollapsed={isRightCollapsed}
          onToggleCollapse={() => setIsRightCollapsed(!isRightCollapsed)}
        >
          {/* Ask AEGIS Component */}
          <AskAegis
            currentInputs={inputs}
            previousInputs={previousInputs}
            currentContext={explanationContext}
            externalQuery={externalAskQuery}
            aiVoiceEnabled={aiVoiceEnabled}
          />
        </StatusPanel>

        {/* Full-width NO SAFE EVACUATION ROUTE overlay at z-45 */}
        <NoSafeEvacuationOverlay
          isVisible={simulationState.currentRoute.safetyStatus === "WILL_NOT_REACH_SAFETY"}
          reason={
            simulationState.currentRoute.unreachableReason ||
            "Flash floodwaters or physical accessibility barriers have severed all routes to designated shelters."
          }
        />
      </main>

      {/* 5. Bottom Timeline Controller */}
      <Timeline
        minute={inputs.simulationMinute}
        onChangeMinute={(min) => updateInputs({ simulationMinute: min })}
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying(!isPlaying)}
        playbackSpeed={playbackSpeed}
        onToggleSpeed={() => setPlaybackSpeed(playbackSpeed === 1 ? 2 : 1)}
      />

      {/* 6. Notification Toasts Container */}
      <Toasts
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />
    </div>
  );
}
