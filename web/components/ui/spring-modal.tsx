"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, CheckCircle2 } from "lucide-react";

interface SpringModalProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm?: (method: string) => void;
  confirmText?: string;
  cancelText?: string;
}

export default function SpringModal({
  isOpen,
  setIsOpen,
  title,
  description,
  onConfirm,
  confirmText = "Confirm",
  cancelText = "Cancel",
}: SpringModalProps) {
  const [selectedMethod, setSelectedMethod] = useState("paystack");

  const paymentOptions = [
    { id: "paystack", name: "Paystack", type: "Card/Bank/USSD", active: true },
    { id: "wallet", name: "Luxe Wallet", type: "Account Balance", active: true },
    { id: "flutterwave", name: "Flutterwave", type: "Mobile Money", active: false },
    { id: "monnify", name: "Monnify", type: "Direct Transfer", active: false },
    { id: "crypto", name: "Stablecoin Bridge", type: "USDT / USDC", active: false },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsOpen(false)}
          className="bg-[#1B0A2E]/60 backdrop-blur-md p-4 sm:p-8 fixed inset-0 z-50 grid place-items-center overflow-y-auto cursor-pointer"
        >
          <motion.div
            initial={{ scale: 0.9, rotate: "2deg", y: 20 }}
            animate={{ scale: 1, rotate: "0deg", y: 0 }}
            exit={{ scale: 0.9, rotate: "0deg", y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-gradient-to-br from-[#6B3FA0] to-[#1B0A2E] text-white p-6 rounded-2xl w-full max-w-md shadow-2xl shadow-purple-900/40 cursor-default relative overflow-hidden border border-purple-400/15"
          >
            <Sparkles className="text-white/5 rotate-12 text-[200px] absolute z-0 -top-16 -left-16 pointer-events-none" />
            
            <div className="relative z-10 text-center">
              <div className="bg-purple-400/15 w-12 h-12 mb-3 rounded-full text-2xl text-purple-300 grid place-items-center mx-auto border border-purple-400/20">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-serif font-semibold text-center mb-1 tracking-wide">
                {title}
              </h3>
              <p className="text-center text-xs text-purple-200/70 mb-5 leading-relaxed">
                {description}
              </p>

              {/* Payment Methods Options List */}
              <div className="text-left space-y-2 mb-6">
                <span className="text-[10px] uppercase font-bold tracking-widest text-purple-300/70 block mb-1">
                  Choose Payment Method
                </span>
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {paymentOptions.map((opt) => (
                    <div
                      key={opt.id}
                      onClick={() => opt.active && setSelectedMethod(opt.id)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all ${
                        opt.active 
                          ? "cursor-pointer hover:bg-white/10" 
                          : "opacity-40 cursor-not-allowed"
                      } ${
                        selectedMethod === opt.id && opt.active
                          ? "border-purple-300 bg-white/15"
                          : "border-white/10 bg-white/5"
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="font-bold text-white flex items-center gap-1.5">
                          {opt.name}
                          {selectedMethod === opt.id && opt.active && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-purple-300 fill-purple-900" />
                          )}
                        </span>
                        <span className="text-[10px] text-purple-200/60">{opt.type}</span>
                      </div>
                      
                      <div>
                        {opt.active ? (
                          <span className="text-[8px] bg-emerald-500/20 text-emerald-300 font-extrabold uppercase px-1.5 py-0.5 rounded-md border border-emerald-500/30 tracking-wider">
                            Active
                          </span>
                        ) : (
                          <span className="text-[8px] bg-white/10 text-white/55 font-extrabold uppercase px-1.5 py-0.5 rounded-md border border-white/5 tracking-wider">
                            Soon
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setIsOpen(false)}
                  className="bg-white/10 hover:bg-white/20 transition-all text-white font-semibold w-full py-2.5 rounded-xl border border-white/20 text-xs uppercase tracking-wider cursor-pointer"
                >
                  {cancelText}
                </button>
                <button
                  onClick={() => {
                    if (onConfirm) onConfirm(selectedMethod);
                    setIsOpen(false);
                  }}
                  className="bg-white hover:bg-purple-50 transition-all text-purple-900 font-semibold w-full py-2.5 rounded-xl text-xs uppercase tracking-wider cursor-pointer shadow-lg shadow-purple-500/15"
                >
                  {confirmText}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
