"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, ChevronLeft, Calendar, LayoutDashboard, ShoppingCart, Tag, BarChart2, Users, Settings, LogOut } from "lucide-react";

interface SidebarProps {
  currentPath?: string;
}

export default function Sidebar({ currentPath = "Dashboard" }: SidebarProps) {
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState(currentPath);

  const OPTIONS = [
    { Icon: LayoutDashboard, title: "Dashboard" },
    { Icon: Calendar, title: "Bookings", notifs: 3 },
    { Icon: ShoppingCart, title: "Products" },
    { Icon: Tag, title: "Tags" },
    { Icon: BarChart2, title: "Analytics" },
    { Icon: Users, title: "Clients" },
    { Icon: Settings, title: "Settings" },
  ];

  return (
    <motion.nav
      layout
      className="sticky top-0 h-screen shrink-0 border-r border-soft bg-white p-4 flex flex-col justify-between shadow-sm z-30"
      style={{
        width: open ? "240px" : "80px",
      }}
    >
      <div>
        <TitleSection open={open} />

        <div className="space-y-1 mt-6">
          {OPTIONS.map((opt) => (
            <Option
              key={opt.title}
              Icon={opt.Icon}
              title={opt.title}
              selected={selected}
              setSelected={setSelected}
              open={open}
              notifs={opt.notifs}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Option
          Icon={LogOut}
          title="Sign Out"
          selected={selected}
          setSelected={setSelected}
          open={open}
        />
        <button
          onClick={() => setOpen((pv) => !pv)}
          className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-soft/40 transition-colors text-primary"
        >
          {open ? (
            <div className="flex items-center gap-2 text-xs font-semibold">
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse Menu</span>
            </div>
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
      </div>
    </motion.nav>
  );
}

const Option = ({
  Icon,
  title,
  selected,
  setSelected,
  open,
  notifs,
}: {
  Icon: React.ElementType;
  title: string;
  selected: string;
  setSelected: (title: string) => void;
  open: boolean;
  notifs?: number;
}) => {
  const isSelected = selected === title;
  return (
    <motion.button
      layout
      onClick={() => setSelected(title)}
      className={`relative flex h-11 w-full items-center rounded-lg transition-colors cursor-pointer ${
        isSelected ? "bg-soft text-brand font-semibold" : "text-gray-500 hover:bg-soft/40 hover:text-primary"
      }`}
    >
      <motion.div
        layout
        className="grid h-full w-12 place-content-center text-lg shrink-0"
      >
        <Icon className="w-5 h-5" />
      </motion.div>
      
      {open && (
        <motion.span
          layout
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs"
        >
          {title}
        </motion.span>
      )}

      {notifs && open && (
        <motion.span
          initial={{ scale: 0, opacity: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute right-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[10px] text-white font-bold"
        >
          {notifs}
        </motion.span>
      )}
    </motion.button>
  );
};

const TitleSection = ({ open }: { open: boolean }) => {
  return (
    <div className="border-b border-soft pb-4 flex items-center gap-3">
      <div className="grid h-10 w-10 shrink-0 place-content-center rounded-lg bg-brand text-white shadow-md">
        <span className="font-serif font-black text-lg">L</span>
      </div>
      {open && (
        <motion.div
          layout
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <span className="block text-xs font-bold text-primary">LuxeBeau Partner</span>
          <span className="block text-[10px] text-gray-400">Artisan Portal</span>
        </motion.div>
      )}
    </div>
  );
};
