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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="card max-w-md w-full p-6 space-y-5 bg-white border border-slate-200 shadow-xl rounded-2xl">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                variant === "danger"
                  ? "bg-rose-100 text-rose-600"
                  : variant === "warning"
                  ? "bg-amber-100 text-amber-600"
                  : "bg-teal-100 text-teal-700"
              }`}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">{title}</h3>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Action Confirmation Required
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition"
            aria-label="Close confirmation dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100">
          {description}
        </p>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="button button-secondary text-xs py-2 px-4"
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`button text-xs py-2 px-5 transition ${getButtonClass()} disabled:opacity-60`}
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
