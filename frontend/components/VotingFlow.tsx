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
  Star,
  ThumbsUp,
  ThumbsDown,
  CheckSquare,
  Square,
  XCircle,
  Sparkles,
  HelpCircle,
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
import { compressPhotoBlob } from "../lib/photoCompress";
import ElectionHeader from "./voter/ElectionHeader";
import ElectionIntro from "./voter/ElectionIntro";
import ElectionVotingView from "./voter/ElectionVotingView";
import VoteReview from "./voter/VoteReview";
import VoteSubmission from "./voter/VoteSubmission";
import VoteSuccess from "./voter/VoteSuccess";

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
  initialVoterName,
  initialVoterInternalId,
  initialExpiresAt,
  onReset,
}: {
  election: {
    id: string;
    name: string;
    election_id?: string;
    voting_type?: string;
    voter_registration_mode?: string;
    description?: string;
    voting_flow_mode?: string;
    enable_step_2?: boolean;
    enable_step_3?: boolean;
    enable_step_4?: boolean;
    enable_step_5?: boolean;
    max_selections?: number;
    allow_abstain?: boolean;
    position_title?: string | null;
    candidate_count?: number;
  };
  initialSession?: string;
  initialVoterId?: string;
  initialVoterName?: string;
  initialVoterInternalId?: string;
  initialExpiresAt?: string;
  onReset?: () => void;
}) {
  const isAnyoneCanVote =
    election?.voter_registration_mode === "quick_entry" ||
    election?.voter_registration_mode === "anyone_can_vote" ||
    election?.voter_registration_mode === "open_enrollment" ||
    election?.voter_registration_mode === "open_registration" ||
    election?.voter_registration_mode === "open" ||
    election?.voter_registration_mode === "public";

  const [stage, setStage] = useState<Stage>("identify");
  const [hasStartedVoting, setHasStartedVoting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [voterId, setVoterId] = useState(initialVoterId || "");
  const [voterFullName, setVoterFullName] = useState(initialVoterName || "");
  const [quickFullName, setQuickFullName] = useState("");
  const [quickPrn, setQuickPrn] = useState("");
  const [duplicateVotedError, setDuplicateVotedError] = useState(false);
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
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [hoveredStar, setHoveredStar] = useState<number>(0);
  const [receipt, setReceipt] = useState("");
  const [castTimestamp, setCastTimestamp] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [photoPhase, setPhotoPhase] = useState<"live" | "preview">("live");
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  // Photo upload lifecycle: idle → uploading → saved | failed
  type PhotoUploadStatus = "idle" | "uploading" | "saved" | "failed";
  const [photoUploadStatus, setPhotoUploadStatus] = useState<PhotoUploadStatus>("idle");
  // Ref version so async callbacks can read latest value without stale closure
  const photoUploadStatusRef = useRef<PhotoUploadStatus>("idle");
  const setPhotoStatus = (s: PhotoUploadStatus) => {
    photoUploadStatusRef.current = s;
    setPhotoUploadStatus(s);
  };
  // Keep compressed blob around for retry-without-retake
  const pendingUploadBlob = useRef<Blob | null>(null);
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
    setDuplicateVotedError(false);

    if (isAnyoneCanVote) {
      const cleanName = quickFullName.trim();
      const cleanPrn = quickPrn.trim().replace(/\s+/g, "");

      if (!cleanName) {
        toast.error("Please enter your Full Name.");
        return;
      }
      if (!cleanPrn) {
        toast.error("Please enter your Voter ID.");
        return;
      }

      try {
        setBusy(true);
        const vRes = await request("/voting/verify-voter", {
          election_id: election.id,
          voter_id: cleanPrn,
          voter_name: cleanName,
        });
        setVoterId(cleanPrn);
        setVoterInternalId(vRes.voter_internal_id);
        setSession(vRes.session_id);
        const defaultExp = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        setSessionExpiresAt(vRes.expires_at || defaultExp);
        toast.success("Voter eligibility verified successfully");
        await advanceFromStage("identify", vRes.session_id);
      } catch (err: any) {
        const msg = readable(err);
        if (
          msg.toLowerCase().includes("already participated") ||
          msg.toLowerCase().includes("already recorded") ||
          msg.toLowerCase().includes("already voted") ||
          msg.toLowerCase().includes("already cast") ||
          err?.status === 409
        ) {
          setDuplicateVotedError(true);
        } else {
          setVerifyError(msg);
          toast.error(msg);
        }
      } finally {
        setBusy(false);
      }
    } else {
      if (!voterFullName.trim()) {
        toast.error("Please enter your Full Name");
        return;
      }
      if (!voterId.trim()) {
        toast.error("Please enter your Voter ID");
        return;
      }

      try {
        setBusy(true);
        const vRes = await request("/voting/verify-voter", {
          election_id: election.id,
          voter_id: voterId.trim(),
          voter_name: voterFullName.trim(),
        });
        setVoterInternalId(vRes.voter_internal_id);
        setSession(vRes.session_id);
        
        // Calculate initial 30m / 15m expiration client fallback if not in progress
        const defaultExp = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        setSessionExpiresAt(vRes.expires_at || defaultExp);

        toast.success("Voter eligibility verified successfully");
        await advanceFromStage("identify", vRes.session_id);
      } catch (err: any) {
        const msg = readable(err);
        if (
          msg.toLowerCase().includes("already cast") ||
          msg.toLowerCase().includes("already participated") ||
          msg.toLowerCase().includes("already recorded") ||
          msg.toLowerCase().includes("already voted") ||
          err?.status === 409
        ) {
          setDuplicateVotedError(true);
        } else {
          setVerifyError(msg);
          toast.error(msg);
          voice.speak(FEEDBACK_MESSAGES[voice.language]?.verify_failed || FEEDBACK_MESSAGES.en.verify_failed);
        }
      } finally {
        setBusy(false);
      }
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

  /**
   * BACKGROUND UPLOAD HELPER
   * Uploads a compressed blob for the current session.
   * Called after voter has already been advanced to the next step.
   * Handles retries internally. Updates photoUploadStatus.
   */
  const uploadPhotoInBackground = async (compressedBlob: Blob, sessionId: string, electionId?: string) => {
    const MAX_RETRIES = 4;
    let lastErr: any = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 1) {
          await new Promise((r) => setTimeout(r, 800 * attempt));
        }

        const formData = new FormData();
        formData.append("file", compressedBlob, "voter_photo.jpg");
        formData.append("session_id", sessionId);
        if (electionId) formData.append("election_id", electionId);

        const response = await api.post("/verification/photo", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        if (response.data.success || response.data.status === "ok") {
      pendingUploadBlob.current = null;
          setPhotoStatus("saved");
          if (response.data.challenge) {
            const arr = response.data.challenge.split(",") as ChallengeType[];
            setChallengesList(arr);
            setCurrentChallengeIdx(0);
            setChallenge(response.data.challenge);
          }
          return;
        }
        lastErr = new Error(response.data.message || "Photo save failed");
      } catch (err: any) {
        lastErr = err;
        const msg = readable(err);
        if (msg.includes("session has expired") || err?.response?.status === 401) {
          // Session expired — cannot retry
          setPhotoUploadStatus("failed");
          return;
        }
      }
    }

    // All retries exhausted
    setPhotoStatus("failed");
    console.error("Photo upload failed after retries:", lastErr);
  };

  /** Retry an already-compressed but failed upload (no retake needed). */
  const handleRetryPhotoUpload = async () => {
    if (!pendingUploadBlob.current || !session) return;
    setPhotoStatus("uploading");
    await uploadPhotoInBackground(pendingUploadBlob.current, session, election?.id);
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

    // Guard: prevent duplicate uploads
    if (photoUploadStatus === "uploading" || photoUploadStatus === "saved") return;

    setBusy(true);
    setVerifyError(null);

    try {
      // Step 1: Compress the captured blob client-side
      let compressedBlob: Blob;
      try {
        compressedBlob = await compressPhotoBlob(capturedBlob);
      } catch {
        compressedBlob = capturedBlob; // Fallback to original if compression fails
      }

      // Store for potential retry without retake
      pendingUploadBlob.current = compressedBlob;

      // Step 2: Clean up captured state immediately
      if (capturedUrl) URL.revokeObjectURL(capturedUrl);
      setCapturedBlob(null);
      setCapturedUrl(null);
      setPhotoPhase("live");

      // Step 3: Mark as uploading and advance voter immediately (non-blocking UX)
      setPhotoStatus("uploading");
      voice.speak(FEEDBACK_MESSAGES[voice.language]?.photo_confirmed || FEEDBACK_MESSAGES.en.photo_confirmed);
      setBusy(false);

      // Step 4: Advance to next stage BEFORE the upload completes
      await advanceFromStage("face");

      // Step 5: Upload in background
      await uploadPhotoInBackground(compressedBlob, session, election?.id);

      if (photoUploadStatusRef.current !== "failed") {
        toast.success("✓ Verification photo securely saved");
      }
    } catch (err: any) {
      const msg = readable(err) || "Photo processing failed. Please try again.";
      setVerifyError(msg);
      toast.error(msg);
      setPhotoStatus("failed");
      setBusy(false);
    }
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


  const votingType = election?.voting_type || "regular";

  // Step 6 -> 7: Proceed to Review Stage
  const proceedToReview = () => {
    if (votingType === "multiple_choice") {
      if (selectedCandidateIds.length === 0) {
        toast.error("Please select at least one option before proceeding.");
        return;
      }
    } else {
      if (!selectedCandidateId) {
        toast.error(
          votingType === "rating"
            ? "Please select a star rating before proceeding."
            : votingType === "yes_no"
            ? "Please choose YES or NO before proceeding."
            : "Please select an option before proceeding."
        );
        return;
      }
    }
    setStage("review");
  };

  // Step 7 -> 8: Submit Vote
  const submitFinalVote = async () => {
    const normType = (election.voting_type || "general").toLowerCase();
    const isMulti =
      normType === "council" ||
      normType === "multiple_choice" ||
      (normType === "custom" && (election.max_selections || 1) > 1);

    if (isMulti) {
      if (selectedCandidateIds.length === 0) {
        toast.error("Please select at least one candidate/choice.");
        return;
      }
    } else {
      if (!selectedCandidateId) {
        toast.error("Please select an option to cast your vote.");
        return;
      }
    }

    // Photo upload safety gate — if photo upload is required (step 3 enabled) and failed, block vote
    if (election.enable_step_3 !== false && photoUploadStatusRef.current === "failed") {
      toast.error("Your verification photo could not be saved. Please retry or retake before casting your ballot.");
      return;
    }

    // If upload is still in-progress, wait briefly for it to complete
    if (election.enable_step_3 !== false && photoUploadStatusRef.current === "uploading") {
      toast.info("Waiting for verification photo to be saved...");
      let waited = 0;
      while (photoUploadStatusRef.current === "uploading" && waited < 15000) {
        await new Promise((r) => setTimeout(r, 500));
        waited += 500;
      }
      // Cast to string to defeat TS narrowing — ref value may have changed to "failed" by async callback
      if ((photoUploadStatusRef.current as string) === "failed") {
        toast.error("Verification photo could not be saved. Please retry before casting your ballot.");
        return;
      }
    }

    try {
      setBusy(true);
      setSubmitError(null);
      const payload: any = {
        election_id: election.id,
        voting_grant: grant,
      };
      if (isMulti) {
        payload.candidate_ids = selectedCandidateIds;
      } else {
        payload.candidate_id = selectedCandidateId;
      }

      if (isAnyoneCanVote) {
        if (quickFullName) payload.voter_name = quickFullName;
        if (quickPrn) payload.prn = quickPrn;
      }

      const r = await request("/voting/cast", payload);
      setReceipt(r.receipt_id);
      setCastTimestamp(r.cast_at || new Date().toISOString());
      setStage("receipt");
      toast.success("Your ballot has been cast and recorded successfully.");
    } catch (err) {
      const errMsg = readable(err);
      setSubmitError(errMsg);
      toast.error(errMsg);
    } finally {
      setBusy(false);
    }
  };


  const selectedCandidate = candidates.find((c) => c.id === selectedCandidateId);
  const selectedCandidatesList = candidates.filter((c) => selectedCandidateIds.includes(c.id));
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
      {/* Floating Photo Upload Status Indicator */}
      {photoUploadStatus === "uploading" && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-medium text-indigo-800 shadow-sm">
          <RefreshCw className="h-3.5 w-3.5 animate-spin text-indigo-600 shrink-0" />
          <span>Saving verification photo in the background…</span>
        </div>
      )}
      {photoUploadStatus === "failed" && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-rose-50 border border-rose-200 rounded-xl shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium text-rose-800">
            <AlertCircle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
            <span>Verification photo could not be saved.</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleRetryPhotoUpload}
              className="text-xs font-bold text-rose-700 underline hover:text-rose-900"
            >
              Retry Upload
            </button>
            <button
              onClick={() => { setPhotoUploadStatus("idle"); setStage("face"); setPhotoPhase("live"); }}
              className="text-xs font-bold text-slate-600 underline hover:text-slate-900"
            >
              Retake Photo
            </button>
          </div>
        </div>
      )}

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
                {duplicateVotedError ? (
                  <div className="p-6 sm:p-8 bg-rose-50 border-2 border-rose-300 rounded-2xl text-center space-y-4 shadow-sm">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-700 border border-rose-300">
                      <AlertCircle className="h-8 w-8 text-rose-600" />
                    </div>

                    <div>
                      <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-widest text-rose-700">
                        SINGLE-VOTE SECURITY POLICY
                      </span>
                      <h2 className="text-xl sm:text-2xl font-black text-rose-950 mt-1">
                        Vote Already Recorded
                      </h2>
                      <p className="text-xs sm:text-sm text-rose-800 mt-2 leading-relaxed">
                        This Voter ID / PRN has already participated in this election. In accordance with strict cryptographic election rules, multiple ballots cannot be submitted for the same Voter ID / PRN.
                      </p>
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDuplicateVotedError(false);
                          if (onReset) onReset();
                          else window.location.reload();
                        }}
                        className="button button-outline border-rose-300 text-rose-900 hover:bg-rose-100 w-full min-h-[46px] font-bold text-xs sm:text-sm"
                      >
                        <ArrowLeft className="h-4 w-4 mr-1.5 inline" />
                        Return to Election Start
                      </button>
                    </div>
                  </div>
                ) : isAnyoneCanVote ? (
                  <>
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-teal-700">
                          Step 1 — Eligibility Check
                        </span>
                        <span className="badge badge-open text-[10px]">Anyone Can Vote</span>
                      </div>
                      <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">VOTER IDENTIFICATION</h2>
                      <p className="mt-1 text-xs text-slate-600">
                        Enter your Full Name and Voter ID / PRN to access your ballot.
                      </p>
                    </div>

                    <form onSubmit={startSession} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          FULL NAME <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          className="field text-sm"
                          required
                          placeholder="e.g. Jane Doe"
                          value={quickFullName}
                          onChange={(e) => setQuickFullName(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          VOTER ID / PRN <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          className="field font-mono text-sm tracking-wider uppercase"
                          required
                          placeholder="e.g. ABC123 or 1234567890"
                          value={quickPrn}
                          onChange={(e) => setQuickPrn(e.target.value)}
                        />
                        <p className="text-[11px] text-amber-700 mt-1">
                          Anyone Can Vote Mode: Pre-registration is not required. Any Voter ID uniquely tracks participation to prevent duplicate voting.
                        </p>
                      </div>

                      {verifyError && (
                        <div className="rounded-xl bg-red-50 p-3.5 text-xs font-medium text-red-700 border border-red-200">
                          {verifyError}
                        </div>
                      )}

                      <button
                        type="submit"
                        className="button button-teal w-full min-h-[48px] text-xs sm:text-sm font-bold shadow-md shadow-teal-700/10"
                        disabled={busy || !quickFullName.trim() || !quickPrn.trim()}
                      >
                        {busy ? "Verifying Eligibility..." : "Continue →"}
                      </button>
                    </form>
                  </>
                ) : (
                  <>
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
                          VOTER FULL NAME <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          className="field"
                          required
                          placeholder="Enter your registered full name"
                          value={voterFullName}
                          onChange={(e) => setVoterFullName(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          VOTER ID <span className="text-red-500">*</span>
                        </label>
                        <input
                          className="field font-mono uppercase"
                          required
                          placeholder="e.g. VOTER-1001"
                          value={voterId}
                          onChange={(e) => setVoterId(e.target.value)}
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
                        disabled={busy || !voterFullName.trim() || !voterId.trim()}
                      >
                        {busy ? "Verifying Identity..." : "Continue to Verification"}
                      </button>
                    </form>
                  </>
                )}
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

            {/* STAGE 5: BALLOT SELECTION (DYNAMIC BY VOTING TYPE) */}
            {stage === "ballot" && (
              <div className="space-y-4 sm:space-y-6">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-teal-700">
                      {votingType === "poll"
                        ? "Community Opinion Poll"
                        : votingType === "multiple_choice"
                        ? "Multiple Choice Ballot"
                        : votingType === "yes_no"
                        ? "Proposal Referendum Ballot"
                        : votingType === "rating"
                        ? "Satisfaction Evaluation Scale"
                        : "Official Secret Ballot"}
                    </span>
                    <span className="badge badge-open text-[10px] sm:text-xs">
                      {votingType === "multiple_choice"
                        ? `Multiple Selections (${selectedCandidateIds.length} Selected)`
                        : votingType === "yes_no"
                        ? "Binary Decision"
                        : votingType === "rating"
                        ? "1–5 Star Rating"
                        : "Single Choice Allowed"}
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{election.name}</h2>
                  <p className="mt-1 text-xs sm:text-sm text-slate-600">
                    {currentInstruction?.display}
                  </p>
                </div>

                {/* 1. YES / NO DECISION BALLOT */}
                {votingType === "yes_no" && (
                  <div className="space-y-4">
                    <div className="p-4 sm:p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
                      <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                        <HelpCircle className="h-3.5 w-3.5 text-slate-400" />
                        Proposal Statement / Measure
                      </span>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                        "{election.description || election.name}"
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      {candidates.map((c) => {
                        const isYes = c.name.toLowerCase().includes("yes") || c.name.toLowerCase().includes("approve");
                        const isSelected = selectedCandidateId === c.id;

                        const handleSelectOption = () => {
                          setSelectedCandidateId(c.id);
                          const msg =
                            voice.language === "hi"
                              ? `आपने ${c.name} का चयन किया है।`
                              : `You have selected ${c.name}.`;
                          voice.speak(msg);
                        };

                        return (
                          <div
                            key={c.id}
                            onClick={handleSelectOption}
                            className={`p-5 sm:p-6 rounded-2xl border-2 cursor-pointer transition-all duration-150 flex flex-col justify-between space-y-3 ${
                              isSelected
                                ? isYes
                                  ? "border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-500/30 shadow-md"
                                  : "border-rose-500 bg-rose-50/80 ring-2 ring-rose-500/30 shadow-md"
                                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div
                                className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold text-white shadow-xs ${
                                  isYes ? "bg-emerald-600" : "bg-rose-600"
                                }`}
                              >
                                {isYes ? (
                                  <ThumbsUp className="h-5 w-5" />
                                ) : (
                                  <ThumbsDown className="h-5 w-5" />
                                )}
                              </div>
                              <span
                                className={`h-5 w-5 rounded-full border flex items-center justify-center ${
                                  isSelected
                                    ? isYes
                                      ? "border-emerald-600 bg-emerald-600 text-white"
                                      : "border-rose-600 bg-rose-600 text-white"
                                    : "border-slate-300 bg-white"
                                }`}
                              >
                                {isSelected && <CheckCircle2 className="h-4 w-4" />}
                              </span>
                            </div>

                            <div>
                              <h4
                                className={`text-lg sm:text-xl font-black ${
                                  isSelected
                                    ? isYes
                                      ? "text-emerald-950"
                                      : "text-rose-950"
                                    : "text-slate-900"
                                }`}
                              >
                                {c.name}
                              </h4>
                              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                                {c.manifesto || (isYes ? "Vote in favor of the proposal." : "Vote in opposition to the proposal.")}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. RATING SCALE BALLOT */}
                {votingType === "rating" && (
                  <div className="space-y-4">
                    <div className="p-4 sm:p-5 bg-white border border-slate-200 rounded-2xl space-y-1.5 shadow-xs">
                      <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                        <HelpCircle className="h-3.5 w-3.5 text-slate-400" />
                        Evaluated Topic / Question
                      </span>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                        "{election.description || election.name}"
                      </h3>
                    </div>

                    {/* Interactive 5-Star Row */}
                    <div className="card p-6 sm:p-8 bg-gradient-to-r from-amber-50/70 via-yellow-50/40 to-white border border-amber-200 rounded-2xl text-center space-y-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-900">
                        Select Your Rating
                      </span>
                      <div className="flex items-center justify-center gap-2 sm:gap-4 py-2">
                        {[1, 2, 3, 4, 5].map((starVal) => {
                          const matchingCand = candidates.find(
                            (c) =>
                              c.name.includes(String(starVal)) ||
                              c.party === String(starVal) ||
                              candidates.indexOf(c) === 5 - starVal
                          ) || candidates[5 - starVal] || candidates[starVal - 1];

                          const activeRating = candidates.findIndex((c) => c.id === selectedCandidateId);
                          const selectedStarNum = activeRating >= 0 ? 5 - activeRating : 0;
                          const isHighlighted = hoveredStar ? starVal <= hoveredStar : starVal <= selectedStarNum;

                          return (
                            <button
                              key={starVal}
                              type="button"
                              onMouseEnter={() => setHoveredStar(starVal)}
                              onMouseLeave={() => setHoveredStar(0)}
                              onClick={() => {
                                if (matchingCand) {
                                  setSelectedCandidateId(matchingCand.id);
                                  voice.speak(`You rated ${starVal} out of 5 stars.`);
                                }
                              }}
                              className="p-1 sm:p-2 transition-transform hover:scale-125 focus:outline-none"
                            >
                              <Star
                                className={`h-9 w-9 sm:h-12 sm:w-12 transition-colors ${
                                  isHighlighted
                                    ? "fill-amber-400 text-amber-500 drop-shadow-sm"
                                    : "text-slate-300 hover:text-amber-300"
                                }`}
                              />
                            </button>
                          );
                        })}
                      </div>

                      {selectedCandidateId ? (
                        <p className="text-xs sm:text-sm font-extrabold text-amber-900">
                          Selected: {candidates.find((c) => c.id === selectedCandidateId)?.name || "Rated"}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500">
                          Click a star above or choose a level below to rate
                        </p>
                      )}
                    </div>

                    {/* Star Level Option Cards */}
                    <div className="space-y-2">
                      {candidates.map((c) => {
                        const isSelected = selectedCandidateId === c.id;
                        return (
                          <div
                            key={c.id}
                            onClick={() => setSelectedCandidateId(c.id)}
                            className={`p-3.5 sm:p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                              isSelected
                                ? "border-amber-500 bg-amber-50/70 ring-2 ring-amber-500/20 shadow-xs"
                                : "border-slate-200 bg-white hover:border-slate-300"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-900 font-extrabold text-xs">
                                ★
                              </span>
                              <div>
                                <h4 className="font-extrabold text-slate-900 text-sm">{c.name}</h4>
                                {c.manifesto && (
                                  <p className="text-[11px] text-slate-500">{c.manifesto}</p>
                                )}
                              </div>
                            </div>
                            <span
                              className={`h-5 w-5 rounded-full border flex items-center justify-center ${
                                isSelected
                                  ? "border-amber-600 bg-amber-600 text-white"
                                  : "border-slate-300 bg-white"
                              }`}
                            >
                              {isSelected && <CheckCircle2 className="h-4 w-4" />}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. MULTIPLE CHOICE BALLOT */}
                {votingType === "multiple_choice" && (
                  <div className="space-y-4">
                    <div className="p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-xl text-xs text-indigo-950 flex items-start gap-2.5">
                      <CheckSquare className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Multi-Selection Enabled:</strong> You may select one or more options that you support. Check each option you wish to vote for.
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {candidates.map((c) => {
                        const isChecked = selectedCandidateIds.includes(c.id);

                        const toggleChoice = () => {
                          if (isChecked) {
                            setSelectedCandidateIds((prev) => prev.filter((id) => id !== c.id));
                          } else {
                            setSelectedCandidateIds((prev) => [...prev, c.id]);
                            voice.speak(`Selected ${c.name}.`);
                          }
                        };

                        return (
                          <div
                            key={c.id}
                            onClick={toggleChoice}
                            className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-3.5 ${
                              isChecked
                                ? "border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-600/30 shadow-xs"
                                : "border-slate-200 bg-white hover:border-slate-300 active:bg-slate-50"
                            }`}
                          >
                            <div className="pt-0.5">
                              {isChecked ? (
                                <CheckSquare className="h-5 w-5 text-indigo-600" />
                              ) : (
                                <Square className="h-5 w-5 text-slate-400" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <h3 className={`text-base font-extrabold ${isChecked ? "text-indigo-950" : "text-slate-900"}`}>
                                  {c.name}
                                </h3>
                                {c.party && (
                                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                                    {c.party}
                                  </span>
                                )}
                              </div>
                              {c.manifesto && (
                                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                                  {c.manifesto}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 4. POLL & 5. REGULAR ELECTION (SINGLE CHOICE) */}
                {(votingType === "regular" || votingType === "poll") && (
                  <div className="space-y-4">
                    {votingType === "poll" && election.description && (
                      <div className="p-4 bg-teal-50/60 border border-teal-200 rounded-xl space-y-1 text-xs">
                        <span className="font-bold text-teal-900 uppercase tracking-wider text-[10px]">
                          Survey Question
                        </span>
                        <p className="text-slate-900 font-bold text-sm">
                          "{election.description}"
                        </p>
                      </div>
                    )}

                    <div className="space-y-2.5 sm:space-y-3">
                      {candidates.map((c) => {
                        const isSelected = selectedCandidateId === c.id;
                        const handleSelectCandidate = () => {
                          setSelectedCandidateId(c.id);
                          const msg =
                            voice.language === "hi"
                              ? `आपने ${c.name} का चयन किया है।`
                              : `You have selected ${c.name}.`;
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
                                  <h3
                                    className={`text-base font-extrabold transition-colors ${
                                      isSelected ? "text-teal-950" : "text-slate-900"
                                    }`}
                                  >
                                    {c.name}
                                  </h3>
                                  {c.party && (
                                    <span
                                      className={`rounded-lg px-2.5 py-0.5 text-xs font-bold border ${
                                        isSelected
                                          ? "bg-teal-100 text-teal-800 border-teal-300"
                                          : "bg-slate-100 text-slate-700 border-slate-200"
                                      }`}
                                    >
                                      {c.party}
                                    </span>
                                  )}
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
                  </div>
                )}

                {/* Footer Action Button */}
                <div className="flex items-center justify-end gap-3 pt-3 sm:pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={proceedToReview}
                    disabled={
                      votingType === "multiple_choice"
                        ? selectedCandidateIds.length === 0
                        : !selectedCandidateId
                    }
                    className="button button-teal w-full sm:w-auto min-h-[48px] text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/10"
                  >
                    <span>Proceed to Review Selection →</span>
                  </button>
                </div>
              </div>
            )}

            {/* STAGE 5: BALLOT SELECTION (DYNAMIC BY ELECTION TYPE) */}
            {stage === "ballot" && (
              !hasStartedVoting ? (
                <ElectionIntro
                  election={election}
                  voterName={quickFullName || voterId || "Eligible Voter"}
                  onStartVoting={() => setHasStartedVoting(true)}
                />
              ) : (
                <ElectionVotingView
                  election={election}
                  candidates={candidates}
                  selectedCandidateId={selectedCandidateId}
                  selectedCandidateIds={selectedCandidateIds}
                  onSelectCandidate={(id) => {
                    setSelectedCandidateId(id);
                  }}
                  onSelectCandidateIds={(ids) => {
                    setSelectedCandidateIds(ids);
                  }}
                  onProceedToReview={() => setStage("review")}
                  onBackToIntro={() => setHasStartedVoting(false)}
                />
              )
            )}

            {/* STAGE 6: REVIEW & CONFIRMATION */}
            {stage === "review" && (
              busy || submitError ? (
                <VoteSubmission
                  error={submitError}
                  onRetry={submitFinalVote}
                  onBackToReview={() => {
                    setSubmitError(null);
                    setBusy(false);
                  }}
                />
              ) : (
                <VoteReview
                  election={election}
                  candidates={candidates}
                  selectedCandidateId={selectedCandidateId}
                  selectedCandidateIds={selectedCandidateIds}
                  voterName={quickFullName || voterId}
                  isSubmitting={busy}
                  onBackToBallot={() => setStage("ballot")}
                  onConfirmVote={submitFinalVote}
                />
              )
            )}

            {/* STAGE 7: RECEIPT */}
            {stage === "receipt" && (
              <VoteSuccess
                electionName={election.name}
                receiptId={receipt}
                castTimestamp={castTimestamp}
                onReset={onReset}
              />
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
