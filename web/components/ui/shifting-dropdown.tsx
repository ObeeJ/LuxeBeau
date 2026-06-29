"use client";

import React, { useEffect, useState, createContext, useContext } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ShoppingBag, Calendar, Sparkles } from "lucide-react";

interface NavContextType {
  onBookSession: () => void;
  onSelectProduct: (name: string) => void;
  closeDropdown: () => void;
}

const NavContext = createContext<NavContextType | undefined>(undefined);

export const useNav = () => {
  const context = useContext(NavContext);
  if (!context) {
    return {
      onBookSession: () => {},
      onSelectProduct: () => {},
      closeDropdown: () => {},
    };
  }
  return context;
};

interface ShiftingDropDownProps {
  onBookSession?: () => void;
  onSelectProduct?: (name: string) => void;
}

export default function ShiftingDropDown({ onBookSession, onSelectProduct }: ShiftingDropDownProps) {
  return (
    <div className="w-full flex justify-center text-primary z-50">
      <Tabs onBookSession={onBookSession} onSelectProduct={onSelectProduct} />
    </div>
  );
}

const Tabs = ({ onBookSession, onSelectProduct }: ShiftingDropDownProps) => {
  const [selected, setSelected] = useState<number | null>(null);
  const [dir, setDir] = useState<null | "l" | "r">(null);

  const handleSetSelected = (val: number | null) => {
    if (typeof selected === "number" && typeof val === "number") {
      setDir(selected > val ? "r" : "l");
    } else if (val === null) {
      setDir(null);
    }
    setSelected(val);
  };

  const closeDropdown = () => handleSetSelected(null);

  const contextValue = {
    onBookSession: onBookSession || (() => {}),
    onSelectProduct: onSelectProduct || (() => {}),
    closeDropdown,
  };

  return (
    <NavContext.Provider value={contextValue}>
      <div
        onMouseLeave={() => handleSetSelected(null)}
        className="relative flex h-fit gap-2"
      >
        {TABS.map((t) => (
          <Tab
            key={t.id}
            selected={selected}
            handleSetSelected={handleSetSelected}
            tab={t.id}
          >
            {t.title}
          </Tab>
        ))}

        <AnimatePresence>
          {selected !== null && <Content dir={dir} selected={selected} />}
        </AnimatePresence>
      </div>
    </NavContext.Provider>
  );
};

const Tab = ({
  children,
  tab,
  handleSetSelected,
  selected,
}: {
  children: React.ReactNode;
  tab: number;
  handleSetSelected: (val: number | null) => void;
  selected: number | null;
}) => {
  return (
    <button
      id={`shift-tab-${tab}`}
      onMouseEnter={() => handleSetSelected(tab)}
      onClick={() => handleSetSelected(tab)}
      className={`flex items-center gap-1 rounded-full px-4 py-2 text-xs uppercase tracking-wider font-semibold transition-all duration-300 cursor-pointer ${
        selected === tab 
          ? "bg-white/95 text-purple-900 shadow-md shadow-purple-500/10" 
          : "text-white/80 hover:text-white hover:bg-white/5"
      }`}
    >
      <span>{children}</span>
      <ChevronDown
        className={`w-3.5 h-3.5 transition-transform duration-300 ${
          selected === tab ? "rotate-180" : ""
        }`}
      />
    </button>
  );
};

const Content = ({
  selected,
  dir,
}: {
  selected: number | null;
  dir: null | "l" | "r";
}) => {
  return (
    <motion.div
      id="overlay-content"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="absolute left-1/2 -translate-x-1/2 top-[calc(100%_+_12px)] w-[480px] rounded-2xl border border-purple-100 bg-white/95 backdrop-blur-xl p-6 shadow-xl shadow-purple-500/8 z-50 text-xs"
    >
      <Bridge />
      <Nub selected={selected} />

      {TABS.map((t) => (
        <div className="overflow-hidden" key={t.id}>
          {selected === t.id && (
            <motion.div
              initial={{
                opacity: 0,
                x: dir === "l" ? 100 : dir === "r" ? -100 : 0,
              }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
            >
              <t.Component />
            </motion.div>
          )}
        </div>
      ))}
    </motion.div>
  );
};

const Bridge = () => (
  <div className="absolute -top-[12px] left-0 right-0 h-[12px]" />
);

const Nub = ({ selected }: { selected: number | null }) => {
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (selected !== null) {
      const hoveredTab = document.getElementById(`shift-tab-${selected}`);
      const overlayContent = document.getElementById("overlay-content");

      if (!hoveredTab || !overlayContent) return;

      const tabRect = hoveredTab.getBoundingClientRect();
      const { left: contentLeft } = overlayContent.getBoundingClientRect();

      const tabCenter = tabRect.left + tabRect.width / 2 - contentLeft;
      // Syncing measured DOM geometry into state is the effect's purpose here.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLeft(tabCenter);
    }
  }, [selected]);

  return (
    <motion.span
      style={{
        clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
      }}
      animate={{ left }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="absolute left-1/2 top-0 h-3 w-4 -translate-x-1/2 -translate-y-full border-b border-purple-100 bg-white/95"
    />
  );
};

const ShopComponent = () => {
  const router = useRouter();
  const { closeDropdown } = useNav();

  const handleSelect = (category: string) => {
    closeDropdown();
    router.push(`/shop?category=${category}`);
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h4 className="font-serif font-bold text-purple-900 mb-3 flex items-center gap-1.5">
            <ShoppingBag className="w-3.5 h-3.5 text-purple-600" /> Skincare Formulas
          </h4>
          <span onClick={() => handleSelect("Skincare")} className="mb-2 block text-gray-500 hover:text-purple-600 transition-colors cursor-pointer">Arami Essentials Elixir</span>
          <span onClick={() => handleSelect("Skincare")} className="mb-2 block text-gray-500 hover:text-purple-600 transition-colors cursor-pointer">Oriki Face Cleanser</span>
          <span onClick={() => handleSelect("Skincare")} className="block text-gray-500 hover:text-purple-600 transition-colors cursor-pointer">Salicylic Therapy Creams</span>
        </div>
        <div>
          <h4 className="font-serif font-bold text-purple-900 mb-3 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-600" /> Body & Hair Oils
          </h4>
          <span onClick={() => handleSelect("Body")} className="mb-2 block text-gray-500 hover:text-purple-600 transition-colors cursor-pointer">R&R Liquid Gold Shea Oil</span>
          <span onClick={() => handleSelect("Body")} className="mb-2 block text-gray-500 hover:text-purple-600 transition-colors cursor-pointer">Organic Lavender Oils</span>
          <span onClick={() => handleSelect("Body")} className="block text-gray-500 hover:text-purple-600 transition-colors cursor-pointer">Premium Whipped Butter</span>
        </div>
      </div>
    </div>
  );
};

const ServicesComponent = () => {
  const router = useRouter();
  const { closeDropdown } = useNav();

  const handleSelect = (query: string) => {
    closeDropdown();
    router.push(`/services?q=${encodeURIComponent(query)}`);
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h4 className="font-serif font-bold text-purple-900 mb-3 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-purple-600" /> Salon Styling
          </h4>
          <span onClick={() => handleSelect("Frontal Lace")} className="mb-2 block text-gray-500 hover:text-purple-600 transition-colors cursor-pointer">Frontal Lace Install</span>
          <span onClick={() => handleSelect("Knotless Braids")} className="mb-2 block text-gray-500 hover:text-purple-600 transition-colors cursor-pointer">Micro-knotless Braids</span>
          <span onClick={() => handleSelect("Haircut")} className="block text-gray-500 hover:text-purple-600 transition-colors cursor-pointer">Stylist Haircut Vetting</span>
        </div>
        <div>
          <h4 className="font-serif font-bold text-purple-900 mb-3 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-600" /> Skin Procedures
          </h4>
          <span onClick={() => handleSelect("Facial")} className="mb-2 block text-gray-500 hover:text-purple-600 transition-colors cursor-pointer">Skin Hydration Facial</span>
          <span onClick={() => handleSelect("Dermatologist")} className="mb-2 block text-gray-500 hover:text-purple-600 transition-colors cursor-pointer">Dermatologist Consults</span>
          <span onClick={() => handleSelect("Laser")} className="block text-gray-500 hover:text-purple-600 transition-colors cursor-pointer">Cosmetic Laser Vetting</span>
        </div>
      </div>
    </div>
  );
};

const PartnershipComponent = () => {
  const { closeDropdown } = useNav();
  return (
    <div className="grid grid-cols-2 gap-4 divide-x divide-purple-100">
      <Link
        href="/partnership/seller"
        onClick={closeDropdown}
        className="flex w-full flex-col items-center justify-center p-4 text-center rounded-xl hover:bg-purple-50/50 group transition-colors"
      >
        <ShoppingBag className="mb-2 text-2xl text-purple-600 group-hover:scale-110 transition-transform duration-300" />
        <span className="font-serif font-bold text-purple-900">Sell Products</span>
        <span className="text-[10px] text-gray-400 mt-1">Host your store & catalog</span>
      </Link>
      <Link
        href="/partnership/artisan"
        onClick={closeDropdown}
        className="flex w-full flex-col items-center justify-center p-4 text-center rounded-xl hover:bg-purple-50/50 group transition-colors"
      >
        <Calendar className="mb-2 text-2xl text-purple-600 group-hover:scale-110 transition-transform duration-300" />
        <span className="font-serif font-bold text-purple-900">Offer Services</span>
        <span className="text-[10px] text-gray-400 mt-1">Accept procedure schedules</span>
      </Link>
    </div>
  );
};

const TABS = [
  {
    title: "Shop",
    Component: ShopComponent,
  },
  {
    title: "Services",
    Component: ServicesComponent,
  },
  {
    title: "Partnership",
    Component: PartnershipComponent,
  },
].map((n, idx) => ({ ...n, id: idx + 1 }));
