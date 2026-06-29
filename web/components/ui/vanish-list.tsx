"use client";

import React, { useEffect, useState } from "react";
import { useAnimate, usePresence, AnimatePresence, motion } from "framer-motion";
import { Clock, Trash2, Plus } from "lucide-react";

interface Task {
  id: string;
  text: string;
  checked: boolean;
  time: string;
}

export default function VanishList() {
  const [tasks, setTasks] = useState<Task[]>([
    { id: "1", text: "Prepare Lavender Organic Hair Oils", checked: false, time: "10 mins" },
    { id: "2", text: "Confirm Salon Appointment with Amara", checked: false, time: "5 mins" },
    { id: "3", text: "Update Luxe Lip Balm Inventory", checked: true, time: "15 mins" },
  ]);

  const [text, setText] = useState("");
  const [time, setTime] = useState("10 mins");

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    const newTask: Task = {
      id: Math.random().toString(36).substring(2, 9),
      text,
      checked: false,
      time,
    };
    setTasks((prev) => [newTask, ...prev]);
    setText("");
  };

  const handleCheck = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, checked: !t.checked } : t))
    );
  };

  const handleRemove = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="w-full max-w-xl p-6 rounded-2xl bg-white border border-purple-100 shadow-sm shadow-purple-100/50">
      <div className="mb-4">
        <h3 className="font-serif font-semibold text-lg text-purple-900">Daily Schedule Checklist</h3>
        <p className="text-xs text-gray-500">Track and check off your storefront tasks.</p>
      </div>

      <div className="space-y-2 mb-6">
        <AnimatePresence>
          {tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onCheck={handleCheck}
              onRemove={handleRemove}
            />
          ))}
        </AnimatePresence>
      </div>

      <form onSubmit={handleAddTask} className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="New task..."
          className="flex-1 px-3 py-2 text-xs border border-purple-100 rounded-xl focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all bg-purple-50/30"
        />
        <div className="flex gap-2 w-full sm:w-auto">
          <input
            type="text"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            placeholder="e.g. 10 mins"
            className="flex-1 sm:w-24 px-3 py-2 text-xs border border-purple-100 rounded-xl focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all bg-purple-50/30"
          />
          <button
            type="submit"
            className="bg-purple-600 text-white p-2.5 rounded-xl hover:bg-purple-700 transition-colors flex items-center justify-center cursor-pointer shadow-sm shadow-purple-200"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}

const TaskItem = ({
  task,
  onCheck,
  onRemove,
}: {
  task: Task;
  onCheck: (id: string) => void;
  onRemove: (id: string) => void;
}) => {
  const [isPresent, safeToRemove] = usePresence();
  const [scope, animate] = useAnimate();

  useEffect(() => {
    if (!isPresent) {
      const exitAnimation = async () => {
        // Change colors, scale slightly, then fly off
        animate("p", { color: task.checked ? "#10b981" : "#f43f5e" }, { duration: 0.15 });
        await animate(scope.current, { scale: 1.02 }, { duration: 0.15 });
        await animate(scope.current, { opacity: 0, x: task.checked ? 30 : -30 }, { duration: 0.35 });
        safeToRemove();
      };
      exitAnimation();
    }
  }, [isPresent]);

  return (
    <motion.div
      ref={scope}
      layout
      className="flex items-center gap-3 p-3 rounded-xl border border-purple-100 bg-purple-50/30"
    >
      <input
        type="checkbox"
        checked={task.checked}
        onChange={() => onCheck(task.id)}
        className="h-4 w-4 rounded border-purple-300 text-purple-600 focus:ring-purple-400 accent-purple-600 cursor-pointer"
      />
      <p className={`text-xs flex-1 text-purple-900 transition-all ${task.checked ? "line-through text-gray-400" : ""}`}>
        {task.text}
      </p>
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1 text-[10px] text-gray-400 bg-white px-2 py-0.5 rounded-lg border border-purple-100">
          <Clock className="w-3 h-3" />
          {task.time}
        </span>
        <button
          onClick={() => onRemove(task.id)}
          className="text-red-400 hover:text-red-600 transition-colors cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
};
