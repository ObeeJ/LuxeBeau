"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, X } from "@/components/icons";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  text: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (text: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

const TOAST_LIMIT = 5;
const TOAST_TTL = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (text: string, type: ToastType = "success") => {
    const newToast: Toast = {
      id: Math.random().toString(36).substring(2, 9),
      text,
      type,
    };
    setToasts((prev) => [newToast, ...prev].slice(0, TOAST_LIMIT));
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-20 z-[9999] flex flex-col gap-2 sm:left-auto sm:right-4 sm:bottom-4 sm:w-80" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} remove={removeToast} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

const ToastItem = ({ toast, remove }: { toast: Toast; remove: (id: string) => void }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      remove(toast.id);
    }, TOAST_TTL);
    return () => clearTimeout(timer);
  }, [toast, remove]);

  const icons = {
    success: <CheckCircle2 className="h-5 w-5 shrink-0 text-ink" aria-hidden />,
    error: <AlertCircle className="h-5 w-5 shrink-0 text-ink" aria-hidden />,
    info: <Info className="h-5 w-5 shrink-0 text-muted" aria-hidden />,
  };

  return (
    <motion.div
      layout
      initial={{ x: 50, opacity: 0, scale: 0.95 }}
      animate={{ x: 0, opacity: 1, scale: 1 }}
      exit={{ x: 50, opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      role={toast.type === "error" ? "alert" : "status"}
      className="pointer-events-auto flex w-full items-start gap-3 rounded-[20px] bg-surface p-4 text-ink shadow-float"
    >
      {icons[toast.type]}
      <div className="t-sub flex-1 font-normal">
        {toast.text}
      </div>
      <button
        onClick={() => remove(toast.id)}
        aria-label="Dismiss notification"
        className="shrink-0 rounded-full p-1 text-muted transition-colors duration-200 hover:bg-canvas hover:text-ink"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </motion.div>
  );
};
