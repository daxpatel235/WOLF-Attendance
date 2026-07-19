import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useApp } from "./store";
import { Dock } from "./components/layout/Dock";
import { Topbar } from "./components/layout/Topbar";
import { BackgroundFX } from "./components/ui/BackgroundFX";
import { TooltipProvider } from "./components/ui/Tooltip";
import { Mascot } from "./components/ui/Mascot";
import { pageVariants } from "./lib/motion";

import { Dashboard } from "./pages/Dashboard";
import { Timetable } from "./pages/Timetable";
import { Subjects } from "./pages/Subjects";
import { Analytics } from "./pages/Analytics";
import { Calendar } from "./pages/Calendar";
import { Academics } from "./pages/Academics";
import { Productivity } from "./pages/Productivity";
import { Settings } from "./pages/Settings";
import { Profile } from "./pages/Profile";
import { Login } from "./pages/Login";
import { Onboarding } from "./pages/Onboarding";

const VIEWS: Record<string, React.FC> = {
  dashboard: Dashboard, timetable: Timetable, subjects: Subjects, analytics: Analytics,
  calendar: Calendar, academics: Academics, productivity: Productivity, profile: Profile, settings: Settings,
};

function LoadingScreen() {
  return (
    <div className="fixed inset-0 grid place-items-center overflow-hidden">
      <BackgroundFX />
      <div className="flex flex-col items-center gap-6">
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 18 }}>
          <Mascot size={96} />
        </motion.div>
        <div className="flex flex-col items-center gap-3">
          <div className="text-2xl font-black tracking-tight font-display">WOLF</div>
          <div className="w-40 h-1.5 rounded-full bg-[var(--surface-3)] overflow-hidden">
            <motion.div className="h-full rounded-full bg-[image:var(--grad)]"
              initial={{ x: "-100%" }} animate={{ x: "100%" }}
              transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }} style={{ width: "60%" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { st, view, loading } = useApp();

  if (loading || !st) return <TooltipProvider><LoadingScreen /></TooltipProvider>;

  // ── Auth / onboarding gate ──
  if (!st.settings?.onboarded) {
    return (
      <TooltipProvider>
        <div className="w-full h-screen relative overflow-hidden">
          <BackgroundFX dense />
          <AnimatePresence mode="wait">
            <motion.div key={view === "login" ? "login" : "onboarding"} variants={pageVariants} initial="initial" animate="animate" exit="exit" className="absolute inset-0">
              {view === "login" ? <Login /> : <Onboarding />}
            </motion.div>
          </AnimatePresence>
        </div>
      </TooltipProvider>
    );
  }

  // ── Main shell ──
  const ViewComponent = VIEWS[view] || Dashboard;
  return (
    <TooltipProvider>
      <div className="flex h-screen w-full overflow-hidden relative">
        <BackgroundFX />
        <Dock />
        <div className="flex-1 flex flex-col min-w-0 h-full py-4 pr-4 pl-2">
          <Topbar />
          <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scroll-area rounded-[var(--r-lg)]">
            <AnimatePresence mode="wait">
              <motion.div key={view} variants={pageVariants} initial="initial" animate="animate" exit="exit"
                className="w-full max-w-[1440px] mx-auto px-6 lg:px-9 pt-3 pb-16">
                <ViewComponent />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
