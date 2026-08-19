"use client";

import { useTheme } from "./ThemeProvider";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";

interface ThemeToggleProps {
  className?: string;
  variant?: "header" | "pill" | "dropdown";
}

export default function ThemeToggle({ className = "", variant = "header" }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Avoid hydration mismatch placeholder matching exact dimensions
    return (
      <div
        className={`h-8 w-8 sm:h-9 sm:w-9 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 animate-pulse ${className}`}
        aria-hidden="true"
      />
    );
  }

  const isDark = theme === "dark";

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={`Switch to ${isDark ? "Light" : "Dark"} Mode (Currently ${isDark ? "Dark" : "Light"})`}
        title={`Switch to ${isDark ? "Light" : "Dark"} Mode`}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all duration-200 text-xs font-bold shadow-xs cursor-pointer ${
          isDark
            ? "bg-slate-900 border-slate-800 text-amber-300 hover:bg-slate-800 hover:border-slate-700"
            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900"
        } ${className}`}
      >
        {isDark ? (
          <>
            <Moon className="h-3.5 w-3.5 text-indigo-400 fill-indigo-400/20" />
            <span>Dark</span>
          </>
        ) : (
          <>
            <Sun className="h-3.5 w-3.5 text-amber-500 fill-amber-500/20" />
            <span>Light</span>
          </>
        )}
      </button>
    );
  }

  if (variant === "dropdown") {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={`Switch to ${isDark ? "Light" : "Dark"} Mode`}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors ${
          isDark
            ? "bg-slate-900/60 text-slate-200 hover:bg-slate-800"
            : "bg-slate-100 text-slate-700 hover:bg-slate-200/70"
        } ${className}`}
      >
        <span className="flex items-center gap-2.5">
          {isDark ? (
            <Moon className="h-4 w-4 text-indigo-400" />
          ) : (
            <Sun className="h-4 w-4 text-amber-500" />
          )}
          <span>Theme Mode</span>
        </span>
        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md font-extrabold bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
          {isDark ? "Dark" : "Light"}
        </span>
      </button>
    );
  }

  // Default "header" compact toggle
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? "Light" : "Dark"} Mode (Currently in ${isDark ? "Dark" : "Light"} Mode)`}
      title={`Switch to ${isDark ? "Light" : "Dark"} Mode`}
      className={`group relative flex items-center justify-center h-8 w-8 sm:h-9 sm:w-9 rounded-full border transition-all duration-200 shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 shrink-0 ${
        isDark
          ? "bg-slate-900/90 border-slate-800 text-indigo-300 hover:bg-slate-800 hover:border-slate-700 hover:text-indigo-200"
          : "bg-slate-100/90 border-slate-200/80 text-slate-700 hover:bg-slate-200 hover:text-slate-900 hover:border-slate-300"
      } ${className}`}
    >
      <div className="relative h-4 w-4 flex items-center justify-center transition-transform duration-300 transform group-active:scale-90">
        {isDark ? (
          <Moon className="h-4 w-4 text-indigo-300 fill-indigo-400/20 transition-all duration-300 rotate-0 scale-100" />
        ) : (
          <Sun className="h-4 w-4 text-amber-500 fill-amber-500/20 transition-all duration-300 rotate-0 scale-100" />
        )}
      </div>
      <span className="sr-only">Toggle theme (Current: {isDark ? "Dark" : "Light"})</span>
    </button>
  );
}
