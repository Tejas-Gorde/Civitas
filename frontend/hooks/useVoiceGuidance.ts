"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import {
  getAvailableVoices,
  getVoiceDiagnostics,
  isSpeechSynthesisSupported,
  speakAsync,
  speakInstruction,
  stopSpeech,
} from "../lib/voice";

const LOCAL_STORAGE_MUTE_KEY = "civitas-voice-muted";
const LOCAL_STORAGE_LANG_KEY = "civitas-voice-lang";

export type VoiceLanguage = "en" | "hi";

export interface VoterAssistanceConfig {
  voice_guidance_enabled: boolean;
  chat_assistant_enabled: boolean;
  default_voice_language: VoiceLanguage;
  chat_read_aloud_enabled: boolean;
  mobile_device_verification_enabled: boolean;
  session_timeout_minutes: number;
  inactivity_timeout_minutes: number;
  step_timeout_minutes: number;
  photo_upload_max_retries: number;
  photo_max_attempts: number | null;
  liveness_max_attempts: number | null;
  supported_languages: string[];
}

export function useVoiceGuidance(isAdmin = false) {
  const [adminVoiceEnabled, setAdminVoiceEnabled] = useState<boolean>(true);
  const [voterMuted, setVoterMuted] = useState<boolean>(false);
  const [language, setLanguageState] = useState<VoiceLanguage>("en");
  const [voiceUnlocked, setVoiceUnlocked] = useState<boolean>(false);
  const [assistanceSettings, setAssistanceSettings] =
    useState<VoterAssistanceConfig>({
      voice_guidance_enabled: true,
      chat_assistant_enabled: true,
      default_voice_language: "en",
      chat_read_aloud_enabled: true,
      mobile_device_verification_enabled: false,
      session_timeout_minutes: 30,
      inactivity_timeout_minutes: 15,
      step_timeout_minutes: 10,
      photo_upload_max_retries: 5,
      photo_max_attempts: null,
      liveness_max_attempts: null,
      supported_languages: ["en", "hi"],
    });
  const [loading, setLoading] = useState<boolean>(true);

  // Track last spoken key to prevent double-fire in React Strict Mode
  const lastSpokenRef = useRef<string>("");

  // ---------------------------------------------------------------------------
  // Initialize from localStorage
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedMute = localStorage.getItem(LOCAL_STORAGE_MUTE_KEY);
      if (storedMute === "true") {
        setVoterMuted(true);
      }
      const storedLang = localStorage.getItem(
        LOCAL_STORAGE_LANG_KEY
      ) as VoiceLanguage;
      if (storedLang === "en" || storedLang === "hi") {
        setLanguageState(storedLang);
      }
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch admin settings from backend
  // ---------------------------------------------------------------------------
  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const path = isAdmin
        ? "/admin/settings/voter-assistance"
        : "/voting/settings/voter-assistance";
      const res = await api.get(path);
      if (res.data) {
        const data = res.data as VoterAssistanceConfig;
        setAssistanceSettings(data);
        setAdminVoiceEnabled(data.voice_guidance_enabled !== false);

        // Use admin default language if voter hasn't overridden
        if (
          typeof window !== "undefined" &&
          !localStorage.getItem(LOCAL_STORAGE_LANG_KEY)
        ) {
          if (
            data.default_voice_language === "en" ||
            data.default_voice_language === "hi"
          ) {
            setLanguageState(data.default_voice_language);
          }
        }
      }
    } catch {
      // Default to TRUE so voice works even if backend is offline
      setAdminVoiceEnabled(true);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // ---------------------------------------------------------------------------
  // Set language
  // ---------------------------------------------------------------------------
  const setLanguage = useCallback((lang: VoiceLanguage) => {
    setLanguageState(lang);
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCAL_STORAGE_LANG_KEY, lang);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Mute toggle
  // ---------------------------------------------------------------------------
  const toggleMute = useCallback(() => {
    setVoterMuted((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem(LOCAL_STORAGE_MUTE_KEY, next ? "true" : "false");
      }
      if (next) {
        stopSpeech();
      }
      return next;
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Speak (for step instructions, feedback messages, chat)
  // ---------------------------------------------------------------------------
  const speak = useCallback(
    (
      text: string,
      speakLang?: VoiceLanguage,
      force = false,
      onNotice?: (msg: string) => void
    ) => {
      const targetLang = speakLang || language;

      if (force) {
        speakInstruction(text, { lang: targetLang, onErrorNotice: onNotice });
        return;
      }

      // Normal path: respect admin + voter mute settings
      if (adminVoiceEnabled && !voterMuted) {
        speakInstruction(text, { lang: targetLang, onErrorNotice: onNotice });
      }
    },
    [adminVoiceEnabled, voterMuted, language]
  );

  // ---------------------------------------------------------------------------
  // Test Voice — async with accurate UI feedback
  // ---------------------------------------------------------------------------
  const testVoice = useCallback(
    async (
      onNotice?: (msg: string) => void
    ): Promise<"success" | "error" | "cancelled"> => {
      const sampleText =
        language === "hi"
          ? "सिविटास सुरक्षित डिजिटल वोटिंग सिस्टम में आपका स्वागत है। यह एक आवाज़ परीक्षण है।"
          : "Welcome to the CIVITAS Secure Digital Voting System. This is a voice test.";

      const result = await speakAsync(sampleText, {
        lang: language,
        onErrorNotice: onNotice,
      });

      if (result === "success") {
        setVoiceUnlocked(true);
      }

      return result;
    },
    [language]
  );

  // ---------------------------------------------------------------------------
  // Enable Voice Guidance — user gesture handler
  // ---------------------------------------------------------------------------
  const enableVoice = useCallback(
    async (
      onNotice?: (msg: string) => void
    ): Promise<"success" | "error" | "cancelled"> => {
      const confirmText =
        language === "hi"
          ? "आवाज़ मार्गदर्शन सक्षम किया गया।"
          : "Voice guidance is now enabled.";

      const result = await speakAsync(confirmText, {
        lang: language,
        onErrorNotice: onNotice,
      });

      if (result === "success") {
        setVoiceUnlocked(true);

        // Unmute if currently muted
        if (voterMuted) {
          setVoterMuted(false);
          if (typeof window !== "undefined") {
            localStorage.setItem(LOCAL_STORAGE_MUTE_KEY, "false");
          }
        }
      }

      return result;
    },
    [language, voterMuted]
  );

  // ---------------------------------------------------------------------------
  // Cancel speech
  // ---------------------------------------------------------------------------
  const cancel = useCallback(() => {
    stopSpeech();
  }, []);

  // ---------------------------------------------------------------------------
  // Clean up on unmount — but DON'T cancel eagerly in dev strict mode
  // ---------------------------------------------------------------------------
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Small delay to avoid React Strict Mode double-mount cancellation
      setTimeout(() => {
        if (!mountedRef.current) {
          stopSpeech();
        }
      }, 200);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Return API
  // ---------------------------------------------------------------------------
  return {
    adminVoiceEnabled,
    setAdminVoiceEnabled,
    voterMuted,
    voiceUnlocked,
    language,
    setLanguage,
    toggleMute,
    speak,
    testVoice,
    enableVoice,
    cancel,
    loading,
    assistanceSettings,
    fetchSettings,
    isSupported: isSpeechSynthesisSupported(),
    getVoices: getAvailableVoices,
    getDiagnostics: () => getVoiceDiagnostics(language),
    lastSpokenRef,
  };
}
