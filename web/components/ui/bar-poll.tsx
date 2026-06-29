"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";

interface Option {
  title: string;
  votes: number;
  color: string;
}

export default function BarPoll() {
  const [options, setOptions] = useState<Option[]>([
    { title: "Shea Skincare", votes: 8, color: "bg-purple-600" },
    { title: "Organic Hair Oils", votes: 12, color: "bg-purple-400" },
    { title: "Vegan Makeup", votes: 4, color: "bg-purple-300" },
  ]);

  const totalVotes = options.reduce((acc, curr) => acc + curr.votes, 0);

  const handleVote = (title: string) => {
    setOptions((prev) =>
      prev.map((opt) => (opt.title === title ? { ...opt, votes: opt.votes + 1 } : opt))
    );
  };

  const handleReset = () => {
    setOptions((prev) => prev.map((opt) => ({ ...opt, votes: 0 })));
  };

  return (
    <div className="w-full max-w-xl p-6 rounded-2xl bg-white border border-purple-100 shadow-sm shadow-purple-100/50">
      <h3 className="font-serif font-semibold text-lg text-purple-900 mb-1">Weekly Beauty Poll</h3>
      <p className="text-xs text-gray-500 mb-6">Which new collection are you most excited to try next?</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        <div className="space-y-2">
          {options.map((opt) => (
            <motion.button
              key={opt.title}
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
              onClick={() => handleVote(opt.title)}
              className="w-full text-left p-3 rounded-xl border border-purple-100 bg-purple-50/30 hover:bg-purple-50 text-xs font-semibold text-purple-900 transition-all flex justify-between items-center cursor-pointer"
            >
              <span>{opt.title}</span>
              <span className="text-gray-400 font-mono font-normal">
                {opt.votes} ({totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0}%)
              </span>
            </motion.button>
          ))}
          <div className="flex justify-between items-center mt-4 pt-2 border-t border-purple-100 text-[10px] text-gray-400 italic">
            <span>{totalVotes} total votes</span>
            <button
              onClick={handleReset}
              className="text-purple-600 hover:underline cursor-pointer not-italic font-semibold"
            >
              Reset Poll
            </button>
          </div>
        </div>

        <div className="flex gap-3 h-48 justify-center items-end bg-purple-50/50 rounded-2xl p-4 border border-purple-100">
          {options.map((opt) => {
            const heightPercentage = totalVotes > 0 ? (opt.votes / totalVotes) * 100 : 0;
            return (
              <div key={opt.title} className="flex-1 h-full flex flex-col justify-end items-center">
                <div className="relative w-full h-[80%] flex items-end bg-purple-100/50 rounded-xl overflow-hidden">
                  <motion.div
                    animate={{ height: `${heightPercentage}%` }}
                    transition={{ type: "spring", stiffness: 100, damping: 15 }}
                    className={`w-full ${opt.color} rounded-t-xl`}
                  />
                </div>
                <span className="text-[9px] text-gray-500 font-bold text-center mt-2 truncate w-full">
                  {opt.title}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
