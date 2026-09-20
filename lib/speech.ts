"use client";

// Web Speech API wrapper for AI Voice Overlay
export class VoiceSynthesizer {
  private static instance: VoiceSynthesizer | null = null;
  private isMuted: boolean = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private onSpeakingChangeCallbacks: Set<(isSpeaking: boolean, text: string) => void> = new Set();

  private constructor() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }

  public static getInstance(): VoiceSynthesizer {
    if (!VoiceSynthesizer.instance) {
      VoiceSynthesizer.instance = new VoiceSynthesizer();
    }
    return VoiceSynthesizer.instance;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.cancel();
    }
  }

  public subscribe(callback: (isSpeaking: boolean, text: string) => void) {
    this.onSpeakingChangeCallbacks.add(callback);
    return () => {
      this.onSpeakingChangeCallbacks.delete(callback);
    };
  }

  private notify(isSpeaking: boolean, text: string = "") {
    this.onSpeakingChangeCallbacks.forEach((cb) => cb(isSpeaking, text));
  }

  public cancel() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    this.currentUtterance = null;
    this.notify(false, "");
  }

  public speak(text: string) {
    if (this.isMuted || typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    // Sanitize text: remove markdown symbols, bolding, URLs
    const sanitized = text
      .replace(/[*_~`#]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!sanitized) return;

    // Cancel existing
    this.cancel();

    try {
      const utterance = new SpeechSynthesisUtterance(sanitized);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.lang = "en-US";

      // Choose preferred voice if available
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice =
        voices.find(
          (v) =>
            v.lang.startsWith("en") &&
            (v.name.includes("Natural") ||
              v.name.includes("Google") ||
              v.name.includes("Samantha") ||
              v.name.includes("Daniel") ||
              v.name.includes("Karen"))
        ) || voices.find((v) => v.lang.startsWith("en"));

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onstart = () => {
        this.notify(true, sanitized);
      };

      utterance.onend = () => {
        this.notify(false, "");
      };

      utterance.onerror = () => {
        this.notify(false, "");
      };

      this.currentUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("SpeechSynthesis error:", err);
      this.notify(false, "");
    }
  }
}

export const aiVoice = typeof window !== "undefined" ? VoiceSynthesizer.getInstance() : null;
