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
import { RaceMode } from "@/components/RaceMode";

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
  const [isRaceModeActive, setIsRaceModeActive] = useState(false);
  const [raceProgress, setRaceProgress] = useState<{ lng: number; lat: number } | null>(null);
  const [committedRoute, setCommittedRoute] = useState<any>(null);

  // Sidebars collapse
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Compute simulation state
  const simulationState = useMemo(() => {
    return runSimulation(inputs, prevState || undefined);
  }, [inputs, prevState]);

  // Update inputs helper
  const updateInputs = useCallback((newPartial: Partial<SimulationInputs>) => {
    setInputs((curr) => {
      setPreviousInputs({ ...curr });
      return { ...curr, ...newPartial };
    });
  }, []);

  // Update previous state when simulation runs
  useEffect(() => {
    setPrevState(simulationState);
  }, [simulationState]);

  // Playback timer loop
  useEffect(() => {
    if (!isPlaying) return;

    const intervalMs = 1000 / playbackSpeed;
    const timer = setInterval(() => {
      setInputs((curr) => {
        if (curr.simulationMinute >= 30) {
          setIsPlaying(false);
          return curr;
        }
        setPreviousInputs({ ...curr });
        return {
          ...curr,
          simulationMinute: Math.min(30, Number((curr.simulationMinute + 0.2).toFixed(1))),
        };
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed]);

  // Event narration & toast triggers
  const scrubDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastNarrationTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!simulationState.events || simulationState.events.length === 0) return;

    const latestEvent: SimulationEvent =
      simulationState.events[simulationState.events.length - 1];

    const deterministicText = composeFallbackForEvent(latestEvent);

    const toastId = `${latestEvent.type}-${latestEvent.minute}-${Date.now()}`;

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

    // Debounce and throttle AI upgrade
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
          }
        }
      } catch {
        // Maintain deterministic text
      }
    }, 700);
  }, [simulationState.events, inputs, previousInputs]);

  // Clean old toasts after 7 seconds
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      const now = Date.now();
      setToasts((prev) => prev.filter((t) => now - t.timestamp < 7000));
    }, 1000);
    return () => clearTimeout(timer);
  }, [toasts]);

  // Build context for AI Assistant
  const explanationContext = useMemo(() => {
    return buildExplanationContext(inputs, previousInputs);
  }, [inputs, previousInputs]);

  // Race Mode toggle: commit route at departure and save pre-race departure time
  const [raceDepartureMinute, setRaceDepartureMinute] = useState<number>(0);
  const preRaceMinuteRef = useRef<number>(0);

  const handleStopRaceMode = useCallback(() => {
    setIsRaceModeActive(false);
    setRaceProgress(null);
    setCommittedRoute(null);
    // Reset departure time and water levels to exactly how they were before race started
    updateInputs({ simulationMinute: preRaceMinuteRef.current });
    // Reset location of the person back to their start junction
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("aegis:evacuee-reset"));
    }
  }, [updateInputs]);

  const handleToggleRaceMode = () => {
    if (isRaceModeActive) {
      handleStopRaceMode();
    } else {
      preRaceMinuteRef.current = inputs.simulationMinute;
      const routeSnapshot = { ...simulationState.currentRoute };
      setCommittedRoute(routeSnapshot);
      setRaceDepartureMinute(inputs.simulationMinute);
      setIsRaceModeActive(true);
    }
  };

  // Open & scroll to AI Assistant chatbot
  const handleOpenAiAssistant = useCallback(() => {
    if (isRightCollapsed) {
      setIsRightCollapsed(false);
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("safepath:open-ai-chat"));
    }
  }, [isRightCollapsed]);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0a0d12] text-slate-100 overflow-hidden font-sans select-none">
      {/* 1. Intro Screen Overlay */}
      {showIntro && <Intro onStart={() => setShowIntro(false)} />}

      {/* 2. Top Bar */}
      <TopBar
        simulationMinute={inputs.simulationMinute}
        onOpenAiAssistant={handleOpenAiAssistant}
        onToggleRaceMode={handleToggleRaceMode}
        isRaceModeActive={isRaceModeActive}
      />

      {/* 3. Main Console Workspace */}
      <main className="flex-1 flex relative overflow-hidden h-[calc(100vh-3.25rem-4rem)]">
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
        <div className="flex-1 min-w-0 relative h-full bg-[#0a0d12]">
          <MapView
            currentRoute={
              isRaceModeActive && committedRoute
                ? committedRoute
                : simulationState.currentRoute
            }
            standardComparison={simulationState.standardComparison}
            showStandardRoute={showStandardRoute}
            evacueeStartJunction={simulationState.evacuee.startJunction}
            simulationMinute={inputs.simulationMinute}
            profileId={inputs.profileId}
            shelters={simulationState.shelters}
            isRaceMode={isRaceModeActive}
            raceProgress={raceProgress}
          />

          {/* Floating Compare HUD */}
          <CompareCard
            accessibleRoute={
              isRaceModeActive && committedRoute
                ? committedRoute
                : simulationState.currentRoute
            }
            standardComparison={simulationState.standardComparison}
            showStandardRoute={showStandardRoute}
            onToggleStandardRoute={() => setShowStandardRoute(!showStandardRoute)}
            isInitiallyMinimized={true}
          />

          {/* Demo Mode Overlay Component */}
          <RaceMode
            isActive={isRaceModeActive}
            onStop={handleStopRaceMode}
            committedRoute={committedRoute || simulationState.currentRoute}
            profile={simulationState.profile}
            departureMinute={raceDepartureMinute}
            onUpdateEvacueePosition={setRaceProgress}
            onAdvanceSimulationMinute={(min) => updateInputs({ simulationMinute: min })}
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
          {/* Ask AI Assistant Component */}
          <AskAegis
            currentInputs={inputs}
            previousInputs={previousInputs}
            currentContext={explanationContext}
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

      {/* 4. Bottom Timeline Controller */}
      <Timeline
        minute={inputs.simulationMinute}
        onChangeMinute={(min) => updateInputs({ simulationMinute: min })}
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying(!isPlaying)}
        playbackSpeed={playbackSpeed}
        onToggleSpeed={() => setPlaybackSpeed(playbackSpeed === 1 ? 2 : 1)}
      />

      {/* 5. Notification Toasts Container */}
      <Toasts
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />
    </div>
  );
}
