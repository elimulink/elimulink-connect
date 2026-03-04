import React, { useEffect, useMemo, useState } from "react";
import TopBar from "../components/TopBar.jsx";
import Drawer from "../components/Drawer.jsx";
import MonthGrid from "../components/MonthGrid.jsx";
import AgendaList from "../components/AgendaList.jsx";
import CreateSheet from "../components/CreateSheet.jsx";
import { apiGet } from "../lib/api.js";
import { getCachedUser } from "../lib/auth.js";

function startOfMonth(d) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}
function monthLabel(d) {
  return d.toLocaleString(undefined, { month: "long" });
}
function iso(d) {
  return new Date(d).toISOString();
}
function addMonths(d, n) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

function SoftIllustration() {
  return (
    <svg viewBox="0 0 900 320" className="w-full h-full">
      <defs>
        <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#CFE2FF" />
          <stop offset="1" stopColor="#EAF2FF" />
        </linearGradient>
        <linearGradient id="hill" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#EAF3EA" />
          <stop offset="1" stopColor="#DCEBDD" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="900" height="320" fill="url(#sky)" />
      <circle cx="720" cy="75" r="34" fill="#FFFFFF" opacity="0.72" />
      <path d="M0 250 C200 190, 340 260, 520 210 C680 165, 790 210, 900 180 L900 320 L0 320 Z" fill="url(#hill)" />
      <path d="M250 290 L410 135 L570 290 Z" fill="#E6F0FF" opacity="0.9" />
      <path d="M340 290 L410 185 L490 290 Z" fill="#FFFFFF" opacity="0.95" />
      <path d="M560 312 L670 190 L780 312 Z" fill="#E6F0FF" opacity="0.86" />
      <path d="M635 312 L670 245 L710 312 Z" fill="#FFFFFF" opacity="0.9" />
      <circle cx="120" cy="155" r="7" fill="#B7D7C0" />
      <circle cx="170" cy="185" r="5" fill="#A7CFB4" />
      <circle cx="215" cy="150" r="6" fill="#B7D7C0" />
    </svg>
  );
}

export default function Calendar() {
  const user = getCachedUser();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [activeMonth, setActiveMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const [items, setItems] = useState([]);
  const [enabled, setEnabled] = useState({
    my: true,
    tasks: true,
    birthdays: false,
    holidays: false,
  });

  useEffect(() => {
    (async () => {
      const range = MonthGrid.getGridRange(activeMonth);
      const data = await apiGet(
        `/items?from=${encodeURIComponent(iso(range.from))}&to=${encodeURIComponent(iso(range.to))}`
      );
      if (data) setItems(data);
    })();
  }, [activeMonth]);

  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      if (it.kind === "TASK") return enabled.tasks;
      return enabled.my;
    });
  }, [items, enabled]);

  const monthChips = useMemo(() => {
    const base = startOfMonth(activeMonth);
    return Array.from({ length: 6 }).map((_, i) => addMonths(base, i));
  }, [activeMonth]);

  return (
    <div className="min-h-screen bg-[#EEF3EE] text-slate-900">
      <TopBar
        monthLabel={monthLabel(activeMonth)}
        onHamburger={() => setDrawerOpen(true)}
        onToday={() => {
          setActiveMonth(startOfMonth(new Date()));
          const d = new Date();
          d.setHours(0, 0, 0, 0);
          setSelectedDay(d);
        }}
        user={user}
      />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        enabled={enabled}
        setEnabled={setEnabled}
        user={user}
      />

      <div className="max-w-5xl mx-auto px-4 pb-28">
        <div className="mt-4 rounded-[30px] bg-white/55 backdrop-blur-xl border border-black/5 shadow-[0_14px_60px_rgba(0,0,0,0.08)] overflow-hidden">
          <div className="px-2 pt-1">
            <MonthGrid
              month={activeMonth}
              items={filteredItems}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
            />
          </div>

          <div className="px-4 pb-3">
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {monthChips.map((m) => {
                const active =
                  m.getMonth() === activeMonth.getMonth() &&
                  m.getFullYear() === activeMonth.getFullYear();

                return (
                  <button
                    key={m.toISOString()}
                    onClick={() => setActiveMonth(startOfMonth(m))}
                    className={
                      "px-4 py-2 rounded-full border text-[14px] font-semibold whitespace-nowrap transition " +
                      (active
                        ? "bg-[#DDE9DD] border-black/5 text-slate-900"
                        : "bg-white/45 border-black/5 text-slate-700 hover:bg-black/5")
                    }
                  >
                    {monthLabel(m)}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 h-[10px] rounded-full bg-[#2F6B58]/20 overflow-hidden">
              <div className="h-full w-[58%] rounded-full bg-[#2F6B58]/65" />
            </div>
          </div>

          <div className="px-4 pb-4">
            <div className="rounded-2xl bg-white/60 border border-black/5 p-3">
              <AgendaList
                day={selectedDay}
                items={filteredItems.filter((it) => {
                  const s = new Date(it.start_at);
                  return (
                    s.getFullYear() === selectedDay.getFullYear() &&
                    s.getMonth() === selectedDay.getMonth() &&
                    s.getDate() === selectedDay.getDate()
                  );
                })}
              />
            </div>
          </div>

          <div className="relative h-[280px]">
            <SoftIllustration />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-[44px] font-semibold tracking-tight text-slate-900/75">
                June 2026
              </div>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => setSheetOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-[#2F6B58] text-white shadow-[0_14px_30px_rgba(0,0,0,0.20)] grid place-items-center text-3xl"
        aria-label="Create"
        title="Create"
      >
        +
      </button>

      <CreateSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  );
}