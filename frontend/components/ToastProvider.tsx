"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";

type ToastType = "success" | "error" | "info";

type Toast = {
  id: number;
  type: ToastType;
  title: string;
  description?: string;
};

type ToastInput = {
  type: ToastType;
  title: string;
  description?: string;
};

type ToastContextValue = {
  showToast: (input: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function getToastStyles(type: ToastType) {
  if (type === "success") {
    return {
      container: "border-green-200 bg-green-50",
      icon: "text-green-600",
      title: "text-green-900",
      description: "text-green-700",
    };
  }

  if (type === "error") {
    return {
      container: "border-red-200 bg-red-50",
      icon: "text-red-600",
      title: "text-red-900",
      description: "text-red-700",
    };
  }

  return {
    container: "border-blue-200 bg-blue-50",
    icon: "text-blue-600",
    title: "text-blue-900",
    description: "text-blue-700",
  };
}

function ToastIcon({ type }: { type: ToastType }) {
  if (type === "success") {
    return <CheckCircle2 className="h-4 w-4" />;
  }
  if (type === "error") {
    return <XCircle className="h-4 w-4" />;
  }
  return <Info className="h-4 w-4" />;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((input: ToastInput) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const toast: Toast = {
      id,
      type: input.type,
      title: input.title,
      description: input.description,
    };
    setToasts((prev) => [...prev, toast]);
    setTimeout(() => removeToast(id), 3500);
  }, [removeToast]);

  const contextValue = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="pointer-events-none fixed right-4 top-20 z-[120] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((toast) => {
          const styles = getToastStyles(toast.type);
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-2 rounded-lg border p-3 shadow-sm ${styles.container}`}
            >
              <div className={`mt-0.5 ${styles.icon}`}>
                <ToastIcon type={toast.type} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${styles.title}`}>{toast.title}</p>
                {toast.description && (
                  <p className={`mt-0.5 text-xs ${styles.description}`}>{toast.description}</p>
                )}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="rounded p-0.5 text-gray-500 hover:bg-white/60"
                aria-label="Dismiss toast"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return ctx;
}
