import { FaceLandmarker, FilesetResolver, FaceLandmarkerResult } from "@mediapipe/tasks-vision";

export type ChallengeType = "smile" | "open_mouth" | "turn_left" | "turn_right";

export class LivenessTracker {
  private video: HTMLVideoElement;
  private landmarker: FaceLandmarker | null = null;
  private isRunning: boolean = false;
  private consecutivePassFrames: number = 0;
  private lastVideoTime: number = -1;
  private requestAnimationId: number | null = null;
  private targetChallenge: ChallengeType | null = null;
  
  // Handlers
  public onFaceLost: () => void = () => {};
  public onFaceFound: () => void = () => {};
  public onMultipleFaces: () => void = () => {};
  public onChallengePassed: () => void = () => {};
  
  // Temporal tolerance
  private FRAMES_TO_PASS = 8;
  private faceLostFrames = 0;

  constructor(videoElement: HTMLVideoElement) {
    this.video = videoElement;
  }

  async initialize() {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12/wasm"
    );
    this.landmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
        delegate: "GPU",
      },
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
      runningMode: "VIDEO",
      numFaces: 2, // Allow 2 so we can detect multi-face violations
    });
  }

  setChallenge(challenge: ChallengeType) {
    this.targetChallenge = challenge;
    this.consecutivePassFrames = 0;
    this.faceLostFrames = 0;
  }

  startTracking() {
    if (this.isRunning || !this.landmarker) return;
    this.isRunning = true;
    this.consecutivePassFrames = 0;
    this.faceLostFrames = 0;
    this.detectFrame();
  }

  stopTracking() {
    this.isRunning = false;
    if (this.requestAnimationId) {
      cancelAnimationFrame(this.requestAnimationId);
      this.requestAnimationId = null;
    }
  }

  dispose() {
    this.stopTracking();
    if (this.landmarker) {
      this.landmarker.close();
      this.landmarker = null;
    }
  }

  private detectFrame = () => {
    if (!this.isRunning || !this.landmarker || !this.video) return;

    if (this.video.currentTime !== this.lastVideoTime && this.video.readyState >= 2) {
      const results = this.landmarker.detectForVideo(this.video, performance.now());
      this.lastVideoTime = this.video.currentTime;
      this.processResults(results);
    }

    if (this.isRunning) {
      this.requestAnimationId = requestAnimationFrame(this.detectFrame);
    }
  };

  private processResults(results: FaceLandmarkerResult) {
    if (results.faceLandmarks.length === 0) {
      this.faceLostFrames++;
      if (this.faceLostFrames > 15) {
        this.onFaceLost();
        this.consecutivePassFrames = 0;
      }
      return;
    }

    if (results.faceLandmarks.length > 1) {
      this.onMultipleFaces();
      this.consecutivePassFrames = 0;
      return;
    }

    if (this.faceLostFrames > 0) {
      this.onFaceFound();
      this.faceLostFrames = 0;
    }

    const blendshapes = results.faceBlendshapes[0]?.categories;
    const landmarks = results.faceLandmarks[0];

    if (!blendshapes || !landmarks || !this.targetChallenge) return;

    // Build dictionary of blendshapes
    const shapes: Record<string, number> = {};
    for (const b of blendshapes) {
      shapes[b.categoryName] = b.score;
    }

    let isPassingFrame = false;

    // Check challenge
    switch (this.targetChallenge) {
      case "smile":
        // Smile requires both left and right lip corners to be pulled up
        if ((shapes["mouthSmileLeft"] > 0.4 || shapes["mouthSmileRight"] > 0.4)) {
          isPassingFrame = true;
        }
        break;
      
      case "open_mouth":
        if (shapes["jawOpen"] > 0.25) {
          isPassingFrame = true;
        }
        break;

      case "turn_left":
      case "turn_right":
        // 3D pose estimation using nose (1) vs left cheek (234) and right cheek (454)
        // If user turns left, their nose moves toward the right cheek in 2D space (camera mirror).
        const nose = landmarks[1];
        const leftCheek = landmarks[234];
        const rightCheek = landmarks[454];
        
        const distLeft = Math.abs(nose.x - leftCheek.x);
        const distRight = Math.abs(rightCheek.x - nose.x);
        const ratio = distLeft / (distRight + 0.0001); // Avoid div by zero

        // In mirrored webcam:
        // Turn Left (User turns head to their left): Nose moves toward the left side of the image (which is rightCheek 454).
        // So distRight gets very small, ratio goes up.
        // Turn Right: Nose moves toward leftCheek (234), distLeft gets very small, ratio goes down.
        
        if (this.targetChallenge === "turn_left" && ratio > 1.8) {
           isPassingFrame = true;
        } else if (this.targetChallenge === "turn_right" && ratio < 0.55) {
           isPassingFrame = true;
        }
        break;
    }

    if (isPassingFrame) {
      this.consecutivePassFrames++;
      if (this.consecutivePassFrames >= this.FRAMES_TO_PASS) {
        this.consecutivePassFrames = 0; // Reset for next challenge
        this.onChallengePassed();
      }
    } else {
      // Tolerate tiny stutters by decaying rather than resetting instantly
      this.consecutivePassFrames = Math.max(0, this.consecutivePassFrames - 1);
    }
  }
}
