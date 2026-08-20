"use client";

import React from "react";
import { AlertTriangle, RefreshCw, X } from "lucide-react";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "primary";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const getButtonClass = () => {
    switch (variant) {
      case "danger":
        return "bg-rose-600 hover:bg-rose-700 text-white font-bold";
      case "warning":
        return "bg-amber-600 hover:bg-amber-700 text-white font-bold";
      default:
        return "button-teal font-bold";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/85 backdrop-blur-xs p-3.5 sm:p-4 animate-in fade-in duration-200">
      <div className="card max-w-md w-full p-5 sm:p-6 space-y-4 sm:space-y-5 bg-white dark:bg-[#0a0d11] border border-slate-200 dark:border-[#1a222c] shadow-2xl rounded-2xl">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div
              className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                variant === "danger"
                  ? "bg-rose-100 dark:bg-[#280f12] text-rose-600 dark:text-rose-400 border border-transparent dark:border-[#3d1418]"
                  : variant === "warning"
                  ? "bg-amber-100 dark:bg-[#261d09] text-amber-600 dark:text-amber-400 border border-transparent dark:border-[#3d2e0e]"
                  : "bg-teal-100 dark:bg-[#082421] text-teal-700 dark:text-[#2dd4bf] border border-transparent dark:border-[#0e3834]"
              }`}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#f5f7fa] leading-snug">{title}</h3>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-[#707a88]">
                Action Confirmation Required
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="text-slate-400 hover:text-slate-700 dark:text-[#707a88] dark:hover:text-[#f5f7fa] p-2 rounded-lg transition min-h-[40px] min-w-[40px] flex items-center justify-center"
            aria-label="Close confirmation dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-xs text-slate-600 dark:text-[#a7b0bd] leading-relaxed bg-slate-50 dark:bg-[#080b0f] p-3.5 rounded-xl border border-slate-100 dark:border-[#141a22]">
          {description}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-end gap-2 sm:gap-2.5 pt-2 border-t border-slate-100 dark:border-[#141a22]">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="button button-secondary text-xs py-2.5 px-4 w-full sm:w-auto min-h-[44px] order-2 sm:order-1"
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`button text-xs py-2.5 px-5 transition ${getButtonClass()} disabled:opacity-60 w-full sm:w-auto min-h-[44px] order-1 sm:order-2`}
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin inline mr-1.5" />
                Processing...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
