"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Camera as CameraIcon, AlertCircle } from "lucide-react";

export type CameraHandle = {
  snapshot: () => string;
  snapshotBlob: () => Promise<Blob>;
  stopStream: () => void;
  restartStream: () => Promise<void>;
};

const Camera = forwardRef<CameraHandle>(function Camera(_, ref) {
  const video = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startStream = async () => {
    setError(null);
    if (typeof window !== "undefined" && !window.isSecureContext && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      setError("Camera access requires a secure HTTPS connection. Please access Civitas using the HTTPS URL.");
      return;
    }
    if (!navigator?.mediaDevices?.getUserMedia) {
      setError("Camera access is not supported by this browser. Please use a modern browser like Google Chrome or Safari over HTTPS.");
      return;
    }
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (video.current) {
        video.current.srcObject = stream;
      }
    } catch (err: any) {
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        setError("Camera permission is required for voter verification. Please allow camera access in your browser settings and refresh.");
      } else {
        setError("Camera is unavailable. Check that your camera is connected and not being used by another application.");
      }
    }
  };

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (video.current) {
      video.current.srcObject = null;
    }
  };

  useEffect(() => {
    startStream();
    return () => {
      stopStream();
    };
  }, []);

  useImperativeHandle(ref, () => ({
    snapshot: () => {
      const v = video.current;
      if (!v || !v.videoWidth) throw new Error("Unable to capture the photo. Please try again.");
      const canvas = document.createElement("canvas");
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Failed to get canvas context");
      ctx.drawImage(v, 0, 0);
      return canvas.toDataURL("image/jpeg", 0.9);
    },
    snapshotBlob: () => {
      return new Promise<Blob>((resolve, reject) => {
        const v = video.current;
        if (!v || !v.videoWidth) {
          reject(new Error("Unable to capture the photo. Please try again."));
          return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = v.videoWidth;
        canvas.height = v.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }
        ctx.drawImage(v, 0, 0);
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Unable to create image blob"));
          },
          "image/jpeg",
          0.92
        );
      });
    },
    stopStream,
    restartStream: startStream,
  }));


  if (error) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center rounded-xl border border-slate-300 bg-slate-100 p-6 text-center text-slate-700">
        <AlertCircle className="mb-2 h-10 w-10 text-amber-600" />
        <p className="font-semibold text-slate-900">Webcam Access Notice</p>
        <p className="mt-1 text-xs text-slate-600">{error}</p>
      </div>
    );
  }


  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-md">
      <video
        ref={video}
        autoPlay
        muted
        playsInline
        className="aspect-video w-full object-cover"
        aria-label="Live webcam preview"
      />

      {/* Face Positioning Oval Boundary Guide (OmniVote Pattern) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        <div className="w-48 h-64 sm:w-56 sm:h-72 border-2 border-dashed border-indigo-400/90 rounded-[50%] shadow-[0_0_0_9999px_rgba(15,23,42,0.5)] flex flex-col items-center justify-between p-4 transition-all">
          <div className="w-full text-center">
            <span className="bg-indigo-600/90 backdrop-blur-md text-white text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-xs">
              Position Face Inside Oval
            </span>
          </div>
          <div className="w-full text-center mb-2">
            <span className="text-[10px] font-bold text-slate-300 bg-slate-900/80 px-2 py-0.5 rounded-md backdrop-blur-sm">
              Keep Steady
            </span>
          </div>
        </div>
      </div>

      {/* Live Badge Status */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 rounded-full bg-slate-900/80 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-md border border-slate-700/60 shadow-xs">
        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <CameraIcon className="h-3.5 w-3.5 text-indigo-400" />
        <span>LIVE CAMERA</span>
      </div>
    </div>
  );

});

export default Camera;
