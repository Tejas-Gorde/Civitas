"use client";

// ============================================================================
// CIVITAS CENTRALIZED SPEECH ENGINE
// ============================================================================
// Single source of truth for all browser speech synthesis in the application.
// Uses a state-machine approach (IDLE → CANCELLING → SPEAKING → IDLE) to
// prevent the Chrome/macOS race condition where cancel() + immediate speak()
// causes the new utterance to be silently cancelled.
//
// All components MUST use this module's speakInstruction() / stopSpeech()
// instead of calling window.speechSynthesis directly.
// ============================================================================

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

/** Holds a global reference to the active utterance to prevent V8 GC from collecting it mid-speech. */
let currentUtterance: SpeechSynthesisUtterance | null = null;

/** Cached voice list (refreshed on voiceschanged). */
let cachedVoices: SpeechSynthesisVoice[] = [];

/** Monotonically increasing request ID. Used to discard stale callbacks. */
let currentRequestId = 0;

/**
 * Speech engine state machine:
 *  IDLE       – nothing playing, ready to accept speak() calls
 *  CANCELLING – cancel() was called, waiting for engine to fully stop
 *  SPEAKING   – an utterance is actively being spoken
 */
type SpeechState = "IDLE" | "CANCELLING" | "SPEAKING";
let speechState: SpeechState = "IDLE";

/** Last speech result for diagnostics. */
let lastResult: "none" | "success" | "cancelled" | "error" = "none";
let lastError: string | null = null;

/** Chrome keep-alive interval handle. */
let keepAliveInterval: ReturnType<typeof setInterval> | null = null;

// ---------------------------------------------------------------------------
// Browser support check
// ---------------------------------------------------------------------------

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// ---------------------------------------------------------------------------
// Voice loading & caching
// ---------------------------------------------------------------------------

function loadVoicesSync(): SpeechSynthesisVoice[] {
  if (!isSpeechSynthesisSupported()) return [];
  try {
    const v = window.speechSynthesis.getVoices();
    if (v.length > 0) cachedVoices = v;
  } catch {
    // Silently ignore — voices may not be ready yet
  }
  return cachedVoices;
}

export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (cachedVoices.length > 0) return cachedVoices;
  return loadVoicesSync();
}

// Bootstrap voice loading at module init time (runs once in browser)
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  try {
    loadVoicesSync();
    window.speechSynthesis.onvoiceschanged = () => {
      const prev = cachedVoices.length;
      cachedVoices = window.speechSynthesis.getVoices();
      console.log(
        `[Civitas Speech Engine] voiceschanged: ${prev} → ${cachedVoices.length} voices`
      );
    };
  } catch (e) {
    console.warn("[Civitas Speech Engine] Voice init error:", e);
  }
}

// ---------------------------------------------------------------------------
// Voice selection
// ---------------------------------------------------------------------------

export function selectBestVoice(
  voices: SpeechSynthesisVoice[],
  lang: string
): SpeechSynthesisVoice | undefined {
  if (lang === "hi") {
    return (
      voices.find(
        (v) =>
          v.lang === "hi-IN" || v.lang === "hi_IN" || v.lang.startsWith("hi")
      ) ||
      voices.find(
        (v) =>
          v.name.toLowerCase().includes("hindi") ||
          v.name.includes("Lekha") ||
          v.name.includes("Neerja") ||
          v.name.includes("Kalpana") ||
          v.name.includes("Google हिन्दी")
      )
    );
  }
  // English (default)
  return (
    voices.find((v) => v.lang === "en-IN" || v.lang === "en_IN") ||
    voices.find(
      (v) =>
        v.lang.startsWith("en") &&
        (v.name.includes("Rishi") ||
          v.name.includes("Veena") ||
          v.name.includes("Samantha") ||
          v.name.includes("Karen") ||
          v.name.includes("Daniel") ||
          v.name.includes("Alex") ||
          v.name.includes("Google"))
    ) ||
    voices.find((v) => v.lang.startsWith("en"))
  );
}

// ---------------------------------------------------------------------------
// Diagnostics (used by admin panel)
// ---------------------------------------------------------------------------

export function getVoiceDiagnostics(lang: "en" | "hi" = "en") {
  const supported = isSpeechSynthesisSupported();
  const voices = getAvailableVoices();
  const targetLang = lang === "hi" ? "hi-IN" : "en-IN";
  const selectedVoice = selectBestVoice(voices, lang);

  return {
    supported,
    voicesLoaded: voices.length > 0,
    voiceCount: voices.length,
    selectedLanguage: targetLang,
    selectedVoiceName: selectedVoice
      ? `${selectedVoice.name} (${selectedVoice.lang})`
      : "Browser Default Voice",
    speechState,
    lastResult,
    lastError,
  };
}

// ---------------------------------------------------------------------------
// Chrome keep-alive workaround
// ---------------------------------------------------------------------------
// Chrome on macOS pauses long utterances after ~15s. Periodically calling
// resume() while speaking prevents this.

function startKeepAlive() {
  stopKeepAlive();
  keepAliveInterval = setInterval(() => {
    if (isSpeechSynthesisSupported() && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }
  }, 5000);
}

function stopKeepAlive() {
  if (keepAliveInterval !== null) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
}

// ---------------------------------------------------------------------------
// Stop / cancel speech
// ---------------------------------------------------------------------------

export function stopSpeech(): void {
  if (!isSpeechSynthesisSupported()) return;
  try {
    currentRequestId++;
    speechState = "IDLE";
    window.speechSynthesis.cancel();
    currentUtterance = null;
    stopKeepAlive();
  } catch {
    // Ignore
  }
}

// ---------------------------------------------------------------------------
// SpeakOptions
// ---------------------------------------------------------------------------

export interface SpeakOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  lang?: "en" | "hi" | string;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
  onErrorNotice?: (msg: string) => void;
}

// ---------------------------------------------------------------------------
// Core speak function
// ---------------------------------------------------------------------------
// This is the ONLY function that should call speechSynthesis.speak().
// It safely cancels any prior utterance, waits for the cancel to propagate,
// and only then starts the new utterance.

export function speakInstruction(text: string, options?: SpeakOptions): void {
  if (!isSpeechSynthesisSupported()) {
    console.warn("[Civitas Speech Engine] SpeechSynthesis not supported");
    options?.onErrorNotice?.(
      "Voice guidance is not supported by this browser."
    );
    options?.onError?.("not-supported");
    return;
  }

  const trimmedText = text ? text.trim() : "";
  if (!trimmedText) return;

  const requestId = ++currentRequestId;

  // Determine language and voice up front (before any async work)
  const requestedLang = options?.lang || "en";
  const targetLang = requestedLang === "hi" ? "hi-IN" : "en-IN";

  // Force-refresh voices if cache is empty
  if (cachedVoices.length === 0) loadVoicesSync();
  const voices = cachedVoices;
  const selectedVoice = selectBestVoice(voices, requestedLang);

  console.log("[Civitas Speech Engine] speak requested:", {
    text: trimmedText.substring(0, 60) + (trimmedText.length > 60 ? "…" : ""),
    lang: targetLang,
    voice: selectedVoice
      ? `${selectedVoice.name} (${selectedVoice.lang})`
      : "default",
    id: requestId,
  });

  // ---- Step 1: Cancel any existing speech ----
  try {
    speechState = "CANCELLING";
    window.speechSynthesis.cancel();
    stopKeepAlive();
    currentUtterance = null;
  } catch {
    // Ignore cancel errors
  }

  // ---- Step 2: Build the utterance ----
  const utterance = new SpeechSynthesisUtterance(trimmedText);
  utterance.lang = targetLang;
  utterance.rate = options?.rate ?? 0.95;
  utterance.pitch = options?.pitch ?? 1.0;
  utterance.volume = options?.volume ?? 1.0;

  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }

  // ---- Step 3: Attach lifecycle handlers ----
  utterance.onstart = () => {
    if (currentRequestId !== requestId) return;
    speechState = "SPEAKING";
    console.log("[Civitas Speech Engine] utterance started (id:", requestId, ")");
    options?.onStart?.();
    startKeepAlive();
  };

  utterance.onend = () => {
    if (currentRequestId !== requestId) return;
    speechState = "IDLE";
    lastResult = "success";
    lastError = null;
    currentUtterance = null;
    stopKeepAlive();
    console.log("[Civitas Speech Engine] utterance ended (id:", requestId, ")");
    options?.onEnd?.();
  };

  utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
    if (currentRequestId !== requestId) return;

    const errName = event.error;

    // "canceled" is expected when we intentionally stop/replace an utterance
    if (errName === "canceled" || errName === "interrupted") {
      speechState = "IDLE";
      lastResult = "cancelled";
      currentUtterance = null;
      stopKeepAlive();
      // Silent — this is not a real error
      return;
    }

    speechState = "IDLE";
    lastResult = "error";
    lastError = errName || "unknown";
    currentUtterance = null;
    stopKeepAlive();

    if (errName === "not-allowed") {
      console.warn(
        "[Civitas Speech Engine] Audio blocked by browser. A user gesture is required."
      );
      options?.onErrorNotice?.(
        "Click \"Enable Voice Guidance\" or \"Test Voice\" to allow browser audio."
      );
    } else {
      console.error(
        "[Civitas Speech Engine] utterance error:",
        errName || "unknown"
      );
      options?.onErrorNotice?.(`Voice playback failed: ${errName}`);
    }

    options?.onError?.(errName || "unknown");
  };

  // Store global reference to prevent GC
  currentUtterance = utterance;

  // ---- Step 4: Schedule speak() after cancel propagation ----
  // Chrome/macOS needs 100-150ms after cancel() before speak() will work
  // reliably. 50ms was too short and caused the "canceled" loop.
  const CANCEL_SETTLE_MS = 150;

  setTimeout(() => {
    try {
      // Bail if a newer request has superseded this one
      if (currentRequestId !== requestId) {
        console.log(
          "[Civitas Speech Engine] skipping stale request (id:",
          requestId,
          " current:",
          currentRequestId,
          ")"
        );
        return;
      }

      // Ensure the engine is not paused
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      // Final safety: if somehow speaking is still true, cancel again and retry
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        setTimeout(() => {
          if (currentRequestId !== requestId) return;
          window.speechSynthesis.speak(utterance);
          console.log(
            "[Civitas Speech Engine] speak() called after double-cancel (id:",
            requestId,
            ")"
          );
        }, 100);
        return;
      }

      window.speechSynthesis.speak(utterance);
      console.log(
        "[Civitas Speech Engine] speak() called (id:",
        requestId,
        ")"
      );

      // ---- Step 5: Verify that speech actually starts ----
      // If after 500ms onstart hasn't fired, the utterance may be stuck.
      // This is a known Chrome bug. Try resume().
      setTimeout(() => {
        if (
          currentRequestId === requestId &&
          speechState === "CANCELLING" &&
          !window.speechSynthesis.speaking
        ) {
          console.warn(
            "[Civitas Speech Engine] Speech may be stuck. Attempting resume()..."
          );
          window.speechSynthesis.resume();
        }
      }, 500);
    } catch (err) {
      console.error("[Civitas Speech Engine] speak() threw:", err);
      speechState = "IDLE";
      lastResult = "error";
      lastError = String(err);
      options?.onError?.(String(err));
    }
  }, CANCEL_SETTLE_MS);
}

// ---------------------------------------------------------------------------
// Promise-based speak (used by testVoice / enableVoice for accurate UI)
// ---------------------------------------------------------------------------

export function speakAsync(
  text: string,
  options?: Omit<SpeakOptions, "onStart" | "onEnd" | "onError">
): Promise<"success" | "error" | "cancelled"> {
  return new Promise((resolve) => {
    speakInstruction(text, {
      ...options,
      onEnd: () => resolve("success"),
      onError: () => resolve("error"),
    });

    // Timeout safety: resolve after 15s if nothing happened
    setTimeout(() => resolve("success"), 15000);
  });
}
