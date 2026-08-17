"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  Fingerprint,
  ScanFace,
  ShieldCheck,
  ArrowLeft,
  Copy,
  Printer,
  AlertCircle,
  FileText,
  UserCheck,
  Lock,
  Camera as CameraIcon,
  RotateCcw,
  Save,
  Volume2,
  VolumeX,
  RefreshCw,
  Key,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import SessionTimer from "./SessionTimer";
import Camera, { CameraHandle } from "./Camera";
import { api, readable } from "../lib/api";
import { LivenessTracker, ChallengeType } from "../lib/liveness";
import { authenticateTouchID, registerTouchID, isWebAuthnSupported } from "../lib/webauthn";
import { isMobileDevice } from "../lib/device";
import { useVoiceGuidance } from "../hooks/useVoiceGuidance";
import Chatbot from "./Chatbot";
import { STEP_INSTRUCTIONS, FEEDBACK_MESSAGES, CHALLENGE_TEXTS } from "../lib/translations";

type Stage =
  | "identify"
  | "fingerprint"
  | "face"
  | "challenge"
  | "ballot"
  | "review"
  | "receipt";

interface StageConfig {
  number: number;
  label: string;
  shortLabel: string;
}

const STAGE_CONFIG: Record<Stage, StageConfig> = {
  identify: { number: 1, label: "Identity", shortLabel: "Identity" },
  fingerprint: { number: 2, label: "Device", shortLabel: "Device" },
  face: { number: 3, label: "Photo", shortLabel: "Photo" },
  challenge: { number: 4, label: "Challenge", shortLabel: "Challenge" },
  ballot: { number: 5, label: "Ballot", shortLabel: "Ballot" },
  review: { number: 6, label: "Review", shortLabel: "Review" },
  receipt: { number: 7, label: "Receipt", shortLabel: "Receipt" },
};

const STAGE_ORDER: Stage[] = [
  "identify",
  "fingerprint",
  "face",
  "challenge",
  "ballot",
  "review",
  "receipt",
];

const MOBILE_STAGE_ORDER: Stage[] = [
  "identify",
  "face",
  "challenge",
  "ballot",
  "review",
  "receipt",
];


export default function VotingFlow({
  election,
  initialSession,
  initialVoterId,
  initialVoterInternalId,
  initialExpiresAt,
  onReset,
}: {
  election: {
    id: string;
    name: string;
    election_id?: string;
    voting_flow_mode?: string;
    enable_step_2?: boolean;
    enable_step_3?: boolean;
    enable_step_4?: boolean;
    enable_step_5?: boolean;
  };
  initialSession?: string;
  initialVoterId?: string;
  initialVoterInternalId?: string;
  initialExpiresAt?: string;
  onReset?: () => void;
}) {
  const [stage, setStage] = useState<Stage>("identify");
  const [voterId, setVoterId] = useState(initialVoterId || "");
  const [voterPassword, setVoterPassword] = useState("");
  const [voterInternalId, setVoterInternalId] = useState(initialVoterInternalId || "");
  const [session, setSession] = useState(initialSession || "");
  const [challenge, setChallenge] = useState("");

  // Liveness Tracker State
  const [livenessTracker, setLivenessTracker] = useState<LivenessTracker | null>(null);
  const [challengesList, setChallengesList] = useState<ChallengeType[]>([]);
  const [currentChallengeIdx, setCurrentChallengeIdx] = useState(0);
  const [livenessMessage, setLivenessMessage] = useState<string>("Initializing face tracker...");

  const [grant, setGrant] = useState("");
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>("");
  const [receipt, setReceipt] = useState("");
  const [castTimestamp, setCastTimestamp] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [photoPhase, setPhotoPhase] = useState<"live" | "preview">("live");
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [voiceTestStatus, setVoiceTestStatus] = useState<"idle" | "testing" | "success" | "failed">("idle");
  const [isMobile, setIsMobile] = useState(false);
  const [mobileVerificationEnabled, setMobileVerificationEnabled] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<string | null>(initialExpiresAt || null);
  const camera = useRef<CameraHandle>(null);
  const voice = useVoiceGuidance(false);

  useEffect(() => {
    setIsMobile(isMobileDevice());
    api.get("/voting/settings/voter-assistance")
      .then((res) => {
        if (res.data && typeof res.data.mobile_device_verification_enabled === "boolean") {
          setMobileVerificationEnabled(res.data.mobile_device_verification_enabled);
        }
      })
      .catch(() => {});

    if (initialSession) {
      setSession(initialSession);
      if (initialVoterId) setVoterId(initialVoterId);
      if (initialVoterInternalId) setVoterInternalId(initialVoterInternalId);
      if (initialExpiresAt) setSessionExpiresAt(initialExpiresAt);
      advanceFromStage("identify", initialSession);
    }
  }, [initialSession]);

  const shouldSkipWebAuthn = isMobile && !mobileVerificationEnabled;

  // Dynamically compute activeStageOrder based on election-specific pre-voting verification configuration
  const activeStageOrder = useMemo<Stage[]>(() => {
    const stages: Stage[] = ["identify"];

    // Direct Voting mode disables all pre-voting verification steps
    if (election.voting_flow_mode === "direct") {
      stages.push("ballot", "review", "receipt");
      return stages;
    }

    // Step 2: Device / WebAuthn Passkey
    if (election.enable_step_2 !== false && !shouldSkipWebAuthn) {
      stages.push("fingerprint");
    }

    // Step 3: Voter Photo Capture
    if (election.enable_step_3 !== false) {
      stages.push("face");
    }

    // Step 4: Security Challenge
    if (election.enable_step_4 !== false) {
      stages.push("challenge");
    }

    stages.push("ballot", "review", "receipt");
    return stages;
  }, [
    election.voting_flow_mode,
    election.enable_step_2,
    election.enable_step_3,
    election.enable_step_4,
    election.enable_step_5,
    shouldSkipWebAuthn,
  ]);

  const request = async (path: string, payload: object) => (await api.post(path, payload)).data;

  // Advance dynamically to the next configured stage in activeStageOrder
  const advanceFromStage = async (currentStageKey: Stage, currentSessionId?: string) => {
    const currentIdx = activeStageOrder.indexOf(currentStageKey);
    const nextStage = activeStageOrder[currentIdx + 1] || "ballot";
    const activeSession = currentSessionId || session;

    if (nextStage === "ballot") {
      try {
        setBusy(true);
        if (activeSession) {
          try {
            const r = await request(`/biometric/risk?session_id=${activeSession}`, {});
            setGrant(r.voting_grant);
          } catch (e) {
            console.error("Risk grant error:", e);
          }
        }
        const cs = (await api.get(`/voting/elections/${election.id}/candidates`)).data;
        setCandidates(cs);
        setStage("ballot");
      } catch (err: any) {
        toast.error(readable(err));
      } finally {
        setBusy(false);
      }
    } else {
      setStage(nextStage);
    }
  };

  const currentInstructionKey = stage === "face" && photoPhase === "preview" ? "face_preview" : stage;
  const currentInstruction =
    STEP_INSTRUCTIONS[voice.language]?.[currentInstructionKey] || STEP_INSTRUCTIONS.en[currentInstructionKey];

  // Trigger step-by-step voice guidance once when stage, photoPhase, or language changes
  // Uses voice.lastSpokenRef (from hook) to prevent double-fire in React Strict Mode
  useEffect(() => {
    if (!voice.adminVoiceEnabled || voice.voterMuted) return;

    const speechKey = `${stage}_${photoPhase}_${voice.language}`;
    if (voice.lastSpokenRef.current === speechKey) return;

    if (currentInstruction?.speak) {
      voice.lastSpokenRef.current = speechKey;
      // Small delay lets React finish rendering before initiating speech,
      // avoiding the cancel-before-speak race when effects fire rapidly.
      const timer = setTimeout(() => {
        voice.speak(currentInstruction.speak);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [stage, photoPhase, voice.language, voice.adminVoiceEnabled, voice.voterMuted, currentInstruction?.speak]);

  const replayCurrentInstruction = () => {
    if (currentInstruction?.speak) {
      voice.speak(currentInstruction.speak, voice.language, true);
    }
  };

  // Async handlers for Enable/Test buttons with UI status feedback
  const handleEnableVoice = async () => {
    setVoiceTestStatus("testing");
    const result = await voice.enableVoice((msg) => toast.error(msg));
    if (result === "success") {
      setVoiceTestStatus("success");
      toast.success("✓ Voice guidance enabled");
      setTimeout(() => setVoiceTestStatus("idle"), 3000);
    } else {
      setVoiceTestStatus("failed");
      toast.error("Voice playback failed. Check browser/system audio settings.");
      setTimeout(() => setVoiceTestStatus("idle"), 4000);
    }
  };

  const handleTestVoice = async () => {
    setVoiceTestStatus("testing");
    const result = await voice.testVoice((msg) => toast.error(msg));
    if (result === "success") {
      setVoiceTestStatus("success");
      toast.success("✓ Voice test completed");
      setTimeout(() => setVoiceTestStatus("idle"), 3000);
    } else {
      setVoiceTestStatus("failed");
      toast.error("Voice playback failed. Check browser/system audio settings.");
      setTimeout(() => setVoiceTestStatus("idle"), 4000);
    }
  };


  // Step 1: Authoritative Backend Voter Eligibility Verification
  const startSession = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setVerifyError(null);

    if (!voterId.trim()) {
      toast.error("Please enter your Voter Registration ID");
      return;
    }
    if (!voterPassword.trim()) {
      toast.error("Please enter your Voter Password");
      return;
    }

    try {
      setBusy(true);
      const vRes = await request("/voting/verify-voter", {
        electionId: election.id,
        voterId: voterId.trim(),
        password: voterPassword.trim(),
      });
      setVoterInternalId(vRes.voter_internal_id);
      setSession(vRes.session_id);
      
      // Calculate initial 30m / 15m expiration client fallback if not in progress
      const defaultExp = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      setSessionExpiresAt(vRes.expires_at || defaultExp);

      toast.success("Voter eligibility verified successfully");
      await advanceFromStage("identify", vRes.session_id);
    } catch (err) {
      const msg = readable(err);
      setVerifyError(msg);
      toast.error(msg);
      voice.speak(FEEDBACK_MESSAGES[voice.language]?.verify_failed || FEEDBACK_MESSAGES.en.verify_failed);
    } finally {
      setBusy(false);
    }
  };

  const [needRegistrationForDomain, setNeedRegistrationForDomain] = useState(false);

  const handleRegisterPasskeyForDomain = async () => {
    if (!voterInternalId) {
      toast.error("Voter identification missing. Please return to Step 1.");
      return;
    }
    try {
      setBusy(true);
      setVerifyError(null);
      const currentHost = typeof window !== "undefined" ? window.location.hostname : "this domain";
      toast.info(`Triggering Passkey registration for ${currentHost}...`);
      const options = await request("/webauthn/register/options", { voter_id: voterInternalId });
      const credentialJSON = await registerTouchID(options);
      await request("/webauthn/register/verify", { voter_id: voterInternalId, credential: credentialJSON });
      toast.success(`✓ Passkey registered successfully for ${currentHost}! Proceeding with verification...`);
      setNeedRegistrationForDomain(false);
      await verifyTouchID();
    } catch (regErr: any) {
      console.error("WebAuthn registration error:", regErr);
      const msg = readable(regErr);
      if (msg.includes("relying party ID") || msg.includes("RP ID")) {
        setVerifyError("Device verification could not start because the security domain configuration is invalid.");
      } else {
        setVerifyError(msg);
      }
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  // Step 2: Real WebAuthn / Touch ID Authentication
  const verifyTouchID = async () => {
    setVerifyError(null);
    if (!isWebAuthnSupported()) {
      const msg = "Touch ID / WebAuthn is not available on this device or browser.";
      setVerifyError(msg);
      toast.error(msg);
      return;
    }
    if (!voterInternalId || !session) {
      const msg = "Voter session is missing. Please return to Step 1 and verify eligibility again.";
      setVerifyError(msg);
      toast.error(msg);
      return;
    }
    try {
      setBusy(true);
      const options = await request("/webauthn/authenticate/options", {
        voter_id: voterInternalId,
        session_id: session,
      });

      let credentialJSON: string;
      try {
        credentialJSON = await authenticateTouchID(options);
      } catch (touchErr: any) {
        console.error("WebAuthn browser prompt error:", touchErr);
        const rawMsg = touchErr?.message || "";
        const cancelMsg =
          touchErr?.name === "NotAllowedError" || rawMsg.includes("cancelled")
            ? "Touch ID / Passkey verification was cancelled."
            : rawMsg.includes("relying party ID") || rawMsg.includes("RP ID")
            ? "Device verification could not start because the security domain configuration is invalid."
            : rawMsg || "Touch ID authentication failed. Please try again.";
        setVerifyError(cancelMsg);
        toast.error(cancelMsg);
        voice.speak(FEEDBACK_MESSAGES[voice.language]?.touch_failed || FEEDBACK_MESSAGES.en.touch_failed);
        return;
      }

      const res = await request("/webauthn/authenticate/verify", {
        session_id: session,
        credential: credentialJSON,
      });

      if (res.stage === "fingerprint") {
        toast.success("Touch ID / Passkey verified successfully.");
        voice.speak(FEEDBACK_MESSAGES[voice.language]?.touch_success || FEEDBACK_MESSAGES.en.touch_success);
        await advanceFromStage("fingerprint");
      }
    } catch (err: any) {
      console.error("WebAuthn API error:", err);
      const msg = readable(err);
      if (msg.includes("No registered security credential") || msg.includes("404")) {
        setNeedRegistrationForDomain(true);
        const host = typeof window !== "undefined" ? window.location.hostname : "this domain";
        setVerifyError(`Device authentication needs to be registered again for domain '${host}'. Click below to register your passkey.`);
      } else if (msg.includes("relying party ID") || msg.includes("RP ID") || msg.includes("domain suffix")) {
        setVerifyError("Device verification could not start because the security domain configuration is invalid.");
      } else {
        setVerifyError(msg);
      }
      toast.error(msg);
      voice.speak(FEEDBACK_MESSAGES[voice.language]?.touch_failed || FEEDBACK_MESSAGES.en.touch_failed);
    } finally {
      setBusy(false);
    }
  };

  // Step 3: Voter Photo Capture
  const handleCapturePhoto = async () => {
    setVerifyError(null);
    try {
      if (!camera.current) throw new Error("Camera component is not initialized");
      const blob = await camera.current.snapshotBlob();
      const url = URL.createObjectURL(blob);
      setCapturedBlob(blob);
      setCapturedUrl(url);
      camera.current.stopStream();
      setPhotoPhase("preview");
      voice.speak(FEEDBACK_MESSAGES[voice.language]?.photo_captured || FEEDBACK_MESSAGES.en.photo_captured);
    } catch (err: any) {
      const msg = err.message || "Unable to capture the photo. Please try again.";
      setVerifyError(msg);
      toast.error(msg);
    }
  };

  const handleRetakePhoto = async () => {
    setVerifyError(null);
    if (capturedUrl) {
      URL.revokeObjectURL(capturedUrl);
    }
    setCapturedBlob(null);
    setCapturedUrl(null);
    setPhotoPhase("live");
    if (camera.current) {
      await camera.current.restartStream();
    }
    voice.speak(FEEDBACK_MESSAGES[voice.language]?.photo_retake || FEEDBACK_MESSAGES.en.photo_retake);
  };

  const handleConfirmSavePhoto = async () => {
    setVerifyError(null);
    if (!capturedBlob || !session) {
      const msg = !session
        ? "Your verification session has expired. Please restart verification."
        : "Captured photo is missing. Please retake your photo.";
      setVerifyError(msg);
      toast.error(msg);
      if (!session) setSessionExpired(true);
      return;
    }

    setBusy(true);
    let attempts = 0;
    const maxRetries = 5;
    let lastErr: any = null;

    while (attempts < maxRetries) {
      attempts++;
      try {
        if (attempts > 1) {
          toast.info(`Retrying photo upload (Attempt ${attempts} of ${maxRetries})...`);
          await new Promise((r) => setTimeout(r, 600 * attempts));
        }

        const formData = new FormData();
        formData.append("file", capturedBlob, "voter_photo.jpg");
        formData.append("session_id", session);
        if (voterId) {
          formData.append("voter_id", voterId);
        }
        if (election?.id) {
          formData.append("election_id", election.id);
        }

        const response = await api.post("/verification/photo", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        if (response.data.success || response.data.status === "ok") {
          if (capturedUrl) {
            URL.revokeObjectURL(capturedUrl);
          }
          setCapturedBlob(null);
          setCapturedUrl(null);
          setPhotoPhase("live");
          if (response.data.challenge) {
            const arr = response.data.challenge.split(",") as ChallengeType[];
            setChallengesList(arr);
            setCurrentChallengeIdx(0);
            setChallenge(response.data.challenge);
          } else {
            setChallenge("blink"); // fallback
          }
          toast.success("✓ Photo securely saved");
          voice.speak(FEEDBACK_MESSAGES[voice.language]?.photo_confirmed || FEEDBACK_MESSAGES.en.photo_confirmed);
          setBusy(false);
          await advanceFromStage("face");
          return;
        } else {
          lastErr = new Error(response.data.message || "Photo save failed");
        }
      } catch (err: any) {
        lastErr = err;
        const msg = readable(err);
        if (msg.includes("session has expired") || (err.response && err.response.status === 401)) {
          setSessionExpired(true);
          toast.error("Your voting session has expired.");
          setBusy(false);
          return;
        }
      }
    }

    const msg = readable(lastErr) || "Photo upload was unsuccessful after 5 attempts. Please try again.";
    setVerifyError(msg);
    toast.error(msg);
    setBusy(false);
  };

  // Step 4: Guided Demonstration Challenge Handlers
  // Step 4: Active Liveness Challenge Handlers
  const [challengeStepState, setChallengeStepState] = useState<"idle" | "tracking" | "completed">("idle");

  const startDemoChallenge = async () => {
    if (!session) {
      toast.error("Your verification session has expired.");
      return;
    }
    setVerifyError(null);
    setChallengeStepState("tracking");
    setLivenessMessage("Loading face mesh model...");

    const videoElement = camera.current?.getVideoElement();
    if (!videoElement) {
      setVerifyError("Camera feed not found.");
      setChallengeStepState("idle");
      return;
    }

    try {
      const tracker = new LivenessTracker(videoElement);
      await tracker.initialize();
      setLivenessTracker(tracker);

      tracker.onFaceLost = () => setLivenessMessage("Face lost! Please stay in frame.");
      tracker.onFaceFound = () => setLivenessMessage("Face found! " + getInstructionFor(challengesList[currentChallengeIdx]));
      tracker.onMultipleFaces = () => setLivenessMessage("Multiple faces detected! Please ensure you are alone.");
      
      tracker.onChallengePassed = () => {
        handleChallengePassed(tracker);
      };

      // Start first challenge
      const first = challengesList[0] || "smile";
      setLivenessMessage(getInstructionFor(first));
      tracker.setChallenge(first);
      tracker.startTracking();

    } catch (err) {
      console.error(err);
      setVerifyError("Failed to initialize Face Landmarker. Ensure hardware acceleration is enabled.");
      setChallengeStepState("idle");
    }
  };

  const getInstructionFor = (c: ChallengeType | undefined) => {
    switch (c) {
      case "smile": return "Please smile naturally.";
      case "open_mouth": return "Please open your mouth.";
      case "turn_left": return "Slowly turn your head LEFT.";
      case "turn_right": return "Slowly turn your head RIGHT.";
      default: return "Please look at the camera.";
    }
  };

  const handleChallengePassed = (tracker: LivenessTracker) => {
    tracker.stopTracking();
    
    // Check if there's another challenge
    setCurrentChallengeIdx((prev) => {
      const nextIdx = prev + 1;
      if (nextIdx < challengesList.length) {
        // Start next challenge
        const nextChallenge = challengesList[nextIdx];
        setLivenessMessage(`Great! Now, ${getInstructionFor(nextChallenge)}`);
        tracker.setChallenge(nextChallenge);
        setTimeout(() => {
          tracker.startTracking();
        }, 1500); // 1.5s pause between challenges
        return nextIdx;
      } else {
        // All passed
        completeLiveness(tracker);
        return prev;
      }
    });
  };

  const completeLiveness = async (tracker: LivenessTracker) => {
    setChallengeStepState("completed");
    setLivenessMessage("✓ All challenges completed securely!");
    toast.success("Active liveness passed.");
    
    tracker.dispose();
    setLivenessTracker(null);

    // Finalize session challenge grant with backend
    try {
      setBusy(true);
      await api.post("/biometric/challenge", {
        session_id: session,
        observed_action: "active_liveness_passed",
      });
      setTimeout(() => {
        advanceFromStage("challenge");
      }, 1000);
    } catch (err: any) {
      console.error("Challenge backend error:", err);
      setTimeout(() => {
        advanceFromStage("challenge");
      }, 1000);
    } finally {
      setBusy(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (livenessTracker) {
        livenessTracker.dispose();
      }
    };
  }, [livenessTracker]);

  const forceProceedToBallot = async () => {
    await advanceFromStage("challenge");
  };


  // Step 6 -> 7: Proceed to Review Stage
  const proceedToReview = () => {
    if (!selectedCandidateId) {
      toast.error("Please select a candidate before proceeding.");
      return;
    }
    setStage("review");
  };

  // Step 7 -> 8: Submit Vote
  const submitFinalVote = async () => {
    if (!selectedCandidateId) {
      toast.error("No candidate selected.");
      return;
    }
    try {
      setBusy(true);
      const r = await request("/voting/cast", {
        election_id: election.id,
        candidate_id: selectedCandidateId,
        voting_grant: grant,
      });
      setReceipt(r.receipt_id);
      setCastTimestamp(r.cast_at || new Date().toISOString());
      setStage("receipt");
      toast.success("Your ballot has been cast and recorded successfully.");
    } catch (err) {
      toast.error(readable(err));
    } finally {
      setBusy(false);
    }
  };

  const selectedCandidate = candidates.find((c) => c.id === selectedCandidateId);
  const currentStageIdx = STAGE_ORDER.indexOf(stage);

  const downloadReceiptTxt = () => {
    const text = `CIVITAS SECURE DIGITAL VOTING RECEIPT\n\nElection: ${election.name}\nReceipt ID: ${receipt}\nCast Timestamp: ${new Date(castTimestamp).toLocaleString()}\n\nVerified Cryptographic Record. In accordance with secrecy standards, candidate selection is not recorded on this receipt.`;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Civitas_Vote_Receipt_${receipt.slice(0, 8)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Receipt saved to device");
  };

  const copyReceipt = () => {
    navigator.clipboard.writeText(receipt);
    setCopied(true);
    toast.success("Receipt ID copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  if (sessionExpired) {
    return (
      <div className="card p-8 sm:p-12 text-center space-y-6 max-w-xl mx-auto my-8 border border-slate-200 shadow-md">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-800 border border-amber-300">
          <Clock className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
            Security Timeout Reached
          </span>
          <h2 className="text-2xl font-bold text-slate-900">Your Voting Session Has Expired</h2>
          <p className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
            Your voting session exceeded the maximum security time limit (30 minutes) or inactivity period (15 minutes). No ballot was cast.
          </p>
        </div>
        <div className="pt-2">
          <button
            type="button"
            onClick={() => {
              if (onReset) onReset();
              else window.location.reload();
            }}
            className="button button-teal w-full min-h-[48px] text-sm font-bold flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
          >
            <RotateCcw className="h-5 w-5" />
            <span>Start Again</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Progress Bar Header */}
      <div className="card p-3.5 sm:p-5">
        {/* Desktop Header Audio & Language Toolbar (Locked for Desktop) */}
        <div className="hidden sm:flex items-center justify-between gap-2 border-b border-slate-200 pb-3 mb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Verification Protocol Progress
          </span>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Voice Guidance Language Selector */}
            <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
              <span className="text-[11px] font-bold text-slate-600">Language:</span>
              <select
                value={voice.language}
                onChange={(e) => voice.setLanguage(e.target.value as "en" | "hi")}
                className="bg-transparent text-[11px] font-bold text-slate-900 focus:outline-none cursor-pointer"
              >
                <option value="en">English</option>
                <option value="hi">हिन्दी (Hindi)</option>
              </select>
            </div>

            {/* Enable Voice Guidance User-Gesture Button */}
            {voice.isSupported && voice.adminVoiceEnabled && (
              <button
                type="button"
                onClick={handleEnableVoice}
                disabled={voiceTestStatus === "testing"}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors shadow-sm ${
                  voiceTestStatus === "testing"
                    ? "bg-amber-600 text-white cursor-wait"
                    : voice.voiceUnlocked
                    ? "bg-emerald-700 text-white"
                    : "bg-teal-700 text-white hover:bg-teal-800"
                }`}
                title="Enable Voice Guidance"
              >
                <Volume2 className={`h-3.5 w-3.5 ${voiceTestStatus === "testing" ? "animate-pulse" : ""}`} />
                <span>
                  {voiceTestStatus === "testing"
                    ? "Enabling..."
                    : voice.voiceUnlocked
                    ? "✓ Voice Enabled"
                    : "Enable Voice Guidance"}
                </span>
              </button>
            )}

            {/* Test Voice Button with Status Feedback */}
            {voice.isSupported && voice.adminVoiceEnabled && (
              <button
                type="button"
                onClick={handleTestVoice}
                disabled={voiceTestStatus === "testing"}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors border ${
                  voiceTestStatus === "testing"
                    ? "bg-amber-50 text-amber-800 border-amber-300 cursor-wait"
                    : voiceTestStatus === "success"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                    : voiceTestStatus === "failed"
                    ? "bg-red-50 text-red-800 border-red-300"
                    : "bg-teal-50 text-teal-800 hover:bg-teal-100 border-teal-200"
                }`}
                title="Test Voice Guidance"
              >
                <Volume2 className={`h-3.5 w-3.5 ${voiceTestStatus === "testing" ? "animate-pulse" : ""}`} />
                <span>
                  {voiceTestStatus === "testing"
                    ? "Testing..."
                    : voiceTestStatus === "success"
                    ? "✓ Test Passed"
                    : voiceTestStatus === "failed"
                    ? "✗ Test Failed"
                    : "🔊 Test Voice"}
                </span>
              </button>
            )}

            {/* Replay Step Instructions Button */}
            {voice.isSupported && voice.adminVoiceEnabled && (
              <button
                type="button"
                onClick={replayCurrentInstruction}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 transition-colors"
                title="Replay step instruction"
              >
                <RotateCcw className="h-3.5 w-3.5 text-teal-700" />
                <span>Replay Instructions</span>
              </button>
            )}

            {/* Voice Guidance Mute/Unmute Toggle */}
            {voice.isSupported && (
              <button
                type="button"
                onClick={voice.toggleMute}
                disabled={!voice.adminVoiceEnabled}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors ${
                  !voice.adminVoiceEnabled
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                    : voice.voterMuted
                    ? "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-300"
                    : "bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100"
                }`}
              >
                {!voice.adminVoiceEnabled ? (
                  <>
                    <VolumeX className="h-3.5 w-3.5" />
                    <span>Voice Off</span>
                  </>
                ) : voice.voterMuted ? (
                  <>
                    <VolumeX className="h-3.5 w-3.5" />
                    <span>Muted</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="h-3.5 w-3.5 text-teal-700" />
                    <span>Voice Guidance</span>
                  </>
                )}
              </button>
            )}

            {/* Session Timer Badge */}
            {session && (
              <SessionTimer
                expiresAt={sessionExpiresAt}
                onExpired={() => setSessionExpired(true)}
              />
            )}

            <span className="text-xs font-semibold text-slate-700">
              Step {currentStageIdx + 1} of {activeStageOrder.length}
            </span>
          </div>
        </div>

        {/* Desktop & Tablet Stepper Grid (Locked for Desktop) */}
        <div className={`hidden sm:grid ${activeStageOrder.length === 6 ? "sm:grid-cols-6" : "sm:grid-cols-7"} gap-1 text-center`}>
          {activeStageOrder.map((sKey: Stage, idx: number) => {
            const isCompleted = idx < currentStageIdx;
            const isCurrent = idx === currentStageIdx;
            const cfg = STAGE_CONFIG[sKey];

            return (
              <div key={sKey} className="flex flex-col items-center gap-1.5">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                    isCompleted
                      ? "bg-teal-700 text-white"
                      : isCurrent
                      ? "bg-slate-900 text-white ring-4 ring-teal-100"
                      : "bg-slate-100 text-slate-400 border border-slate-200"
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                </div>
                <span
                  className={`text-[11px] font-medium leading-tight ${
                    isCurrent
                      ? "font-bold text-slate-900"
                      : isCompleted
                      ? "text-teal-800"
                      : "text-slate-400"
                  }`}
                >
                  {cfg.shortLabel}
                </span>
              </div>
            );
          })}
        </div>

        {/* Mobile Stepper Header & Compact Toolbar (<sm) */}
        <div className="sm:hidden space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white shrink-0">
                {currentStageIdx + 1}
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 block leading-tight">
                  {STAGE_CONFIG[stage]?.label || stage}
                </span>
                <span className="text-[10px] text-slate-500 font-semibold">
                  Step {currentStageIdx + 1} of {activeStageOrder.length}
                </span>
              </div>
            </div>

            {/* Mobile Progress Bar */}
            <div className="w-24 bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
              <div
                className="bg-teal-700 h-full transition-all duration-300 rounded-full"
                style={{ width: `${((currentStageIdx + 1) / activeStageOrder.length) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* Mobile Ergonomic Audio & Timer Strip */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1.5">
              {/* Mobile Language Toggle */}
              <div className="flex items-center bg-slate-100 px-2 py-1 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-700">
                <select
                  value={voice.language}
                  onChange={(e) => voice.setLanguage(e.target.value as "en" | "hi")}
                  className="bg-transparent text-[11px] font-bold text-slate-900 focus:outline-none cursor-pointer"
                >
                  <option value="en">EN</option>
                  <option value="hi">HI</option>
                </select>
              </div>

              {/* Mobile Voice Guidance Button */}
              {voice.isSupported && voice.adminVoiceEnabled && (
                <button
                  type="button"
                  onClick={voice.voiceUnlocked ? replayCurrentInstruction : handleEnableVoice}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200 min-h-[30px]"
                >
                  <Volume2 className="h-3 w-3 text-teal-700" />
                  <span>{voice.voiceUnlocked ? "Repeat" : "Voice"}</span>
                </button>
              )}
            </div>

            {/* Session Timer Badge on Mobile */}
            {session && (
              <div className="text-[11px]">
                <SessionTimer
                  expiresAt={sessionExpiresAt}
                  onExpired={() => setSessionExpired(true)}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area for Current Stage */}
      <div className="card p-4 sm:p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={stage}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {/* STAGE 1: IDENTIFY */}
            {stage === "identify" && (
              <div className="mx-auto max-w-xl space-y-4 sm:space-y-6">
                <div>
                  <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-teal-700">
                    Step 1 — Eligibility Check
                  </span>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">Voter Identification</h2>
                  <p className="mt-1 text-xs text-slate-600">
                    {currentInstruction?.display}
                  </p>
                </div>

                <form onSubmit={startSession} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      VOTER REGISTRATION ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      className="field font-mono"
                      required
                      placeholder="e.g. VOTER-1001"
                      value={voterId}
                      onChange={(e) => setVoterId(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      VOTER PASSWORD / SECURITY KEY <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      className="field"
                      required
                      placeholder="Enter password"
                      value={voterPassword}
                      onChange={(e) => setVoterPassword(e.target.value)}
                    />
                  </div>

                  {verifyError && (
                    <div className="rounded-xl bg-red-50 p-3.5 text-xs font-medium text-red-700 border border-red-200">
                      {verifyError}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="button button-teal w-full min-h-[48px] text-xs sm:text-sm font-bold"
                    disabled={busy}
                  >
                    {busy ? "Verifying Record..." : "Verify Voter Eligibility"}
                  </button>
                </form>
              </div>
            )}

            {/* STAGE 2: SECURE DEVICE / BIOMETRIC VERIFICATION (WEBAUTHN PASSKEY) */}
            {stage === "fingerprint" && (
              <div className="mx-auto max-w-xl text-center space-y-4 sm:space-y-6">
                <div className="mx-auto flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                  <Fingerprint className="h-8 w-8 sm:h-10 sm:w-10" />
                </div>

                <div>
                  <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-teal-700">
                    Step 2 — Secure Device Verification
                  </span>
                  <h2 className="text-lg sm:text-2xl font-bold text-slate-900 mt-1">Passkey & Device Security</h2>
                  <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
                    Use your phone's fingerprint, Face ID, or device passkey to securely verify this device.
                  </p>
                </div>

                {verifyError && (
                  <div className="rounded-xl bg-red-50 p-3.5 text-xs font-medium text-red-700 border border-red-200 text-left space-y-2">
                    <p>{verifyError}</p>
                  </div>
                )}

                {needRegistrationForDomain ? (
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={handleRegisterPasskeyForDomain}
                      disabled={busy}
                      className="button button-teal w-full min-h-[48px] text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
                    >
                      <Key className="h-5 w-5" />
                      <span>{busy ? "Registering Passkey..." : "Register Passkey for this Domain"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={verifyTouchID}
                      disabled={busy}
                      className="button button-outline w-full text-xs py-3 text-slate-600 min-h-[44px]"
                    >
                      Already registered? Retry Passkey Verification
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={verifyTouchID}
                    disabled={busy}
                    className="button button-teal w-full min-h-[48px] text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
                  >
                    <Fingerprint className="h-5 w-5" />
                    <span>{busy ? "Awaiting Biometric Prompt..." : "Verify with Passkey"}</span>
                  </button>
                )}
              </div>
            )}

            {/* STAGE 3: PHOTO CAPTURE */}
            {stage === "face" && (
              <div className="mx-auto max-w-xl space-y-4 sm:space-y-6">
                <div>
                  <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-teal-700">
                    Step 3 — Voter Photo Capture
                  </span>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                    {photoPhase === "live" ? "Take Verification Photo" : "Review Captured Photograph"}
                  </h2>
                  <p className="mt-1 text-xs text-slate-600">
                    {currentInstruction?.display}
                  </p>
                </div>

                {photoPhase === "live" ? (
                  <div className="space-y-4">
                    <Camera ref={camera} />
                    <button
                      type="button"
                      onClick={handleCapturePhoto}
                      disabled={busy}
                      className="button button-teal w-full min-h-[48px] font-bold text-xs sm:text-sm"
                    >
                      <CameraIcon className="mr-1.5 h-4 w-4 inline" /> Capture Photo
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 text-center">
                    {capturedUrl && (
                      <div className="relative overflow-hidden rounded-2xl border-2 border-slate-300 shadow-md max-w-sm mx-auto">
                        <img
                          src={capturedUrl}
                          alt="Captured Voter Snapshot"
                          className="w-full h-auto object-cover max-h-[280px] sm:max-h-[320px]"
                        />
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3">
                      <button
                        type="button"
                        onClick={handleRetakePhoto}
                        disabled={busy}
                        className="button button-outline w-full sm:flex-1 min-h-[46px] text-xs font-bold"
                      >
                        <RotateCcw className="mr-1.5 h-4 w-4 inline" /> Retake Photo
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmSavePhoto}
                        disabled={busy}
                        className="button button-teal w-full sm:flex-1 min-h-[46px] text-xs font-bold"
                      >
                        <Save className="mr-1.5 h-4 w-4 inline" /> {busy ? "Saving photo..." : "Confirm & Save Photo"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STAGE 4: ACTIVE LIVENESS CHALLENGE */}
            {stage === "challenge" && (
              <div className="mx-auto max-w-xl text-center space-y-4 sm:space-y-6">
                <div>
                  <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-teal-700">
                    Step 4 — Liveness Check
                  </span>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">Active Verification</h2>
                  <p className="mt-1 text-xs sm:text-sm text-slate-600 leading-relaxed">
                    Please perform the required head movements to verify you are a live person.
                  </p>
                </div>

                {verifyError && (
                  <div className="rounded-xl bg-red-50 p-3.5 text-xs font-medium text-red-700 border border-red-200 text-left">
                    {verifyError}
                  </div>
                )}

                <div className="rounded-2xl bg-slate-950 text-white p-1 overflow-hidden border border-slate-800 shadow-xl space-y-4 relative">
                  {/* Camera must be rendered here for MediaPipe to read it */}
                  <div className={challengeStepState === "completed" ? "opacity-50 pointer-events-none" : ""}>
                    <Camera ref={camera} />
                  </div>
                  
                  {challengeStepState === "tracking" && (
                    <div className="absolute bottom-6 left-0 right-0 px-4 text-center z-30">
                       <div className="bg-slate-900/90 backdrop-blur-md rounded-xl p-4 border border-slate-700 shadow-2xl inline-block max-w-sm w-full mx-auto animate-fade-in">
                          <p className="text-sm sm:text-base font-extrabold text-teal-300">
                            {livenessMessage}
                          </p>
                          <div className="flex justify-center gap-2 mt-3">
                            {challengesList.map((c, i) => (
                              <div key={i} className={`h-2.5 w-2.5 rounded-full transition-colors ${
                                i < currentChallengeIdx ? "bg-teal-400" :
                                i === currentChallengeIdx ? "bg-amber-400 animate-pulse" : "bg-slate-700"
                              }`} />
                            ))}
                          </div>
                       </div>
                    </div>
                  )}

                  {challengeStepState === "completed" && (
                    <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
                      <div className="bg-slate-900 rounded-2xl p-6 border border-slate-700 text-center space-y-3">
                        <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto animate-bounce" />
                        <h3 className="font-bold text-lg text-white">{livenessMessage}</h3>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {challengeStepState === "idle" && (
                    <button
                      type="button"
                      onClick={startDemoChallenge}
                      disabled={busy}
                      className="button button-teal w-full min-h-[48px] text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
                    >
                      <ScanFace className="h-5 w-5" />
                      <span>Start Liveness Check</span>
                    </button>
                  )}

                  {challengeStepState === "tracking" && (
                    <button
                      type="button"
                      onClick={() => {
                        livenessTracker?.dispose();
                        setLivenessTracker(null);
                        setChallengeStepState("idle");
                      }}
                      className="button bg-slate-800 text-slate-300 w-full min-h-[44px] text-xs font-bold"
                    >
                      Cancel / Retry
                    </button>
                  )}

                  {challengeStepState === "completed" && (
                    <button
                      type="button"
                      onClick={forceProceedToBallot}
                      disabled={busy}
                      className="button button-teal w-full min-h-[48px] text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
                    >
                      <CheckCircle2 className="h-5 w-5" />
                      <span>{busy ? "Unlocking Ballot..." : "Challenge Completed — Proceed to Ballot"}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* STAGE 5: BALLOT CANDIDATE SELECTION */}
            {stage === "ballot" && (
              <div className="space-y-4 sm:space-y-6">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-teal-700">
                      Official Secret Ballot
                    </span>
                    <span className="badge badge-open text-[10px] sm:text-xs">Single Choice Allowed</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{election.name}</h2>
                  <p className="mt-1 text-xs sm:text-sm text-slate-600">
                    {currentInstruction?.display}
                  </p>
                </div>

                {/* Candidate Selection List */}
                <div className="space-y-2.5 sm:space-y-3">
                  {candidates.map((c) => {
                    const isSelected = selectedCandidateId === c.id;
                    const handleSelectCandidate = () => {
                      setSelectedCandidateId(c.id);
                      const msg =
                        voice.language === "hi"
                          ? `आपने ${c.name} का चयन किया है। आगे बढ़ने से पहले कृपया अपनी पसंद की समीक्षा करें।`
                          : `You have selected ${c.name}. Please review your choice before continuing.`;
                      voice.speak(msg);
                    };

                    return (
                      <div
                        key={c.id}
                        onClick={handleSelectCandidate}
                        role="radio"
                        aria-checked={isSelected}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === " " || e.key === "Enter") {
                            e.preventDefault();
                            handleSelectCandidate();
                          }
                        }}
                        className={`card-interactive cursor-pointer p-4 sm:p-5 transition-all duration-150 rounded-xl sm:rounded-2xl select-none ${
                          isSelected
                            ? "border-teal-600 bg-teal-50/70 ring-2 ring-teal-600/30 shadow-md"
                            : "hover:border-slate-300 active:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start gap-3 sm:gap-4">
                          <div className="pt-0.5">
                            <input
                              type="radio"
                              name="candidate"
                              checked={isSelected}
                              onChange={handleSelectCandidate}
                              className="h-5 w-5 accent-teal-700 cursor-pointer"
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center justify-between gap-1.5">
                              <h3 className={`text-base font-extrabold transition-colors ${
                                isSelected ? "text-teal-950" : "text-slate-900"
                              }`}>
                                {c.name}
                              </h3>
                              <span className={`rounded-lg px-2.5 py-0.5 text-xs font-bold border ${
                                isSelected
                                  ? "bg-teal-100 text-teal-800 border-teal-300"
                                  : "bg-slate-100 text-slate-700 border-slate-200"
                              }`}>
                                {c.party}
                              </span>
                            </div>
                            {c.manifesto && (
                              <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                                {c.manifesto}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 sm:pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={proceedToReview}
                    disabled={!selectedCandidateId}
                    className="button button-teal w-full sm:w-auto min-h-[48px] text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/10"
                  >
                    Proceed to Review Selection →
                  </button>
                </div>
              </div>
            )}

            {/* STAGE 6: REVIEW */}
            {stage === "review" && (
              <div className="space-y-4 sm:space-y-6">
                <div>
                  <span className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-indigo-600">
                    Step 6 — Ballot Summary Review
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                    Review Ballot Selection
                  </h2>
                  <p className="mt-1 text-xs text-slate-600">
                    {currentInstruction?.display}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 space-y-3 sm:space-y-4 shadow-xs">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2.5 sm:pb-3">
                    <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">Target Election</span>
                    <span className="text-xs sm:text-sm font-extrabold text-slate-900 text-right">{election.name}</span>
                  </div>

                  <div className="flex justify-between items-center border-b border-slate-100 pb-2.5 sm:pb-3">
                    <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">Selected Choice</span>
                    <span className="text-xs sm:text-sm font-extrabold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-xl border border-indigo-100 shadow-xs">
                      {selectedCandidate?.name || "None Selected"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">Security Token Status</span>
                    <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-bold">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Single-Use Grant Active</span>
                    </span>
                  </div>
                </div>

                <div className="rounded-xl bg-amber-50 p-3.5 sm:p-4 text-xs text-amber-900 border border-amber-200 flex items-start gap-2.5 sm:gap-3">
                  <AlertCircle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                  <span>
                    <strong>Final Step:</strong> Clicking "Confirm & Cast Ballot" will permanently submit your anonymous ballot to the electronic tally vault.
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3 pt-1 sm:pt-2">
                  <button
                    type="button"
                    className="button button-outline w-full sm:flex-1 py-3 text-xs font-bold min-h-[46px] order-2 sm:order-1"
                    disabled={busy}
                    onClick={() => setStage("ballot")}
                  >
                    <ArrowLeft className="mr-1.5 h-4 w-4 inline" />
                    Back to Choices
                  </button>
                  <button
                    type="button"
                    className="button button-teal w-full sm:flex-1 disabled:opacity-60 font-extrabold py-3.5 text-xs sm:text-sm shadow-md shadow-indigo-600/20 min-h-[48px] order-1 sm:order-2"
                    disabled={busy}
                    onClick={submitFinalVote}
                  >
                    {busy ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin inline mr-2" />
                        Submitting Encrypted Ballot...
                      </>
                    ) : (
                      "Confirm & Cast Ballot"
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* STAGE 7: RECEIPT */}
            {stage === "receipt" && (
              <div className="mx-auto max-w-lg text-center space-y-4 sm:space-y-6 py-2">
                <div className="mx-auto flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 shadow-md">
                  <CheckCircle2 className="h-8 w-8 sm:h-10 sm:w-10 text-emerald-600" />
                </div>

                <div>
                  <div className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full text-xs font-extrabold text-emerald-800 mb-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <span>Vote Successfully Recorded</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    Official Cryptographic Receipt
                  </h2>
                  <p className="mt-1 text-xs text-slate-600">
                    {currentInstruction?.display}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 text-left space-y-3 sm:space-y-4 shadow-md">
                  <div>
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Election</span>
                    <p className="text-sm sm:text-base font-extrabold text-slate-900 mt-0.5">{election.name}</p>
                  </div>

                  <div>
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Verification Receipt ID</span>
                    <div className="mt-1 flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950 p-3 sm:p-3.5 font-mono text-xs font-bold text-emerald-400 shadow-inner">
                      <span className="break-all">{receipt}</span>
                      <button
                        type="button"
                        onClick={copyReceipt}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold shrink-0 transition min-h-[34px]"
                      >
                        <Copy className="h-3.5 w-3.5 mr-1 inline" />
                        {copied ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Cast Timestamp</span>
                    <p className="text-xs text-slate-700 font-mono font-bold mt-0.5">
                      {new Date(castTimestamp).toLocaleString()}
                    </p>
                  </div>

                  <div className="border-t border-slate-100 pt-3 text-[11px] text-slate-500 leading-relaxed">
                    * In accordance with privacy standards, this receipt contains no candidate selection details and serves solely as cryptographic proof of participation.
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3 pt-2">
                  <button
                    type="button"
                    className="button button-outline text-xs min-h-[44px] px-5 font-bold w-full sm:w-auto"
                    onClick={downloadReceiptTxt}
                  >
                    <Save className="mr-2 h-4 w-4 inline text-indigo-600" />
                    Save Receipt
                  </button>
                  <button
                    type="button"
                    className="button button-outline text-xs min-h-[44px] px-5 font-bold w-full sm:w-auto"
                    onClick={() => window.print()}
                  >
                    <Printer className="mr-2 h-4 w-4 inline text-slate-700" />
                    Print Receipt
                  </button>
                  {onReset && (
                    <button
                      type="button"
                      className="button button-teal text-xs min-h-[44px] px-5 w-full sm:w-auto"
                      onClick={onReset}
                    >
                      Finish & Exit
                    </button>
                  )}
                </div>
              </div>
            )}
          </motion.div>

        </AnimatePresence>
      </div>

      <Chatbot
        language={voice.language}
        adminEnabled={voice.assistanceSettings.chat_assistant_enabled}
        readAloudEnabled={voice.assistanceSettings.chat_read_aloud_enabled}
      />
    </div>
  );
}
