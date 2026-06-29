"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

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
      <div className="flex flex-col gap-2 w-80 fixed bottom-4 right-4 z-[9999] pointer-events-none">
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
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />,
    info: <AlertCircle className="w-5 h-5 text-purple-300 shrink-0" />,
  };

  return (
    <motion.div
      layout
      initial={{ x: 50, opacity: 0, scale: 0.95 }}
      animate={{ x: 0, opacity: 1, scale: 1 }}
      exit={{ x: 50, opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="p-4 flex items-start gap-3 rounded-2xl shadow-lg shadow-purple-900/20 border border-purple-400/10 bg-[#1B0A2E]/95 backdrop-blur-xl text-white pointer-events-auto w-full"
    >
      {icons[toast.type]}
      <div className="flex-1 text-xs font-medium leading-tight">
        {toast.text}
      </div>
      <button
        onClick={() => remove(toast.id)}
        className="text-white/40 hover:text-white transition-colors cursor-pointer shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
};
