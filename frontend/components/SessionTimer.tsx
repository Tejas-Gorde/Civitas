"use client";

import { useEffect, useState, useRef } from "react";
import { Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface SessionTimerProps {
  expiresAt?: string | null;
  onExpired?: () => void;
  className?: string;
}

export default function SessionTimer({
  expiresAt,
  onExpired,
  className = "",
}: SessionTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const warned5m = useRef(false);
  const warned1m = useRef(false);

  useEffect(() => {
    if (!expiresAt) {
      setSecondsLeft(30 * 60); // Default 30 min timer display fallback
      return;
    }

    const calculateRemaining = () => {
      const expDate = new Date(expiresAt).getTime();
      const now = new Date().getTime();
      const diffSec = Math.max(0, Math.floor((expDate - now) / 1000));
      setSecondsLeft(diffSec);

      // Warning toasts at 5m and 1m
      if (diffSec <= 300 && diffSec > 60 && !warned5m.current) {
        warned5m.current = true;
        toast.warning("Your voting session will expire in approximately 5 minutes.");
      }
      if (diffSec <= 60 && diffSec > 0 && !warned1m.current) {
        warned1m.current = true;
        toast.error("Your voting session will expire soon! Please complete your ballot.");
      }

      if (diffSec === 0 && onExpired) {
        onExpired();
      }
    };

    calculateRemaining();
    const interval = setInterval(calculateRemaining, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

  if (secondsLeft === null) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const isLow = secondsLeft <= 300;
  const isCritical = secondsLeft <= 60;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all border ${
        isCritical
          ? "bg-red-50 text-red-700 border-red-300 animate-pulse"
          : isLow
          ? "bg-amber-50 text-amber-800 border-amber-300"
          : "bg-slate-100 text-slate-700 border-slate-200"
      } ${className}`}
      title="Session remaining time based on security policy"
    >
      {isCritical || isLow ? (
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <Clock className="h-3.5 w-3.5 shrink-0 text-teal-700" />
      )}
      <span>Session: {formattedTime}</span>
    </div>
  );
}
