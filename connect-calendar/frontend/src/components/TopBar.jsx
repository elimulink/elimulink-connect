import React from "react";
import { signOut } from "../lib/auth.js";

function IconButton({ children, onClick, label }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="w-10 h-10 rounded-2xl grid place-items-center hover:bg-black/5 active:scale-[0.99] transition"
    >
      {children}
    </button>
  );
}

const MenuIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
  </svg>
);

const SearchIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" stroke="currentColor" strokeWidth="2.2"/>
    <path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
  </svg>
);

const TodayIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path d="M7 3v2M17 3v2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    <path d="M4.5 7.5h15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    <path d="M6 5h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="2.2"/>
  </svg>
);

const DropIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export default function TopBar({ monthLabel, onHamburger, onToday, user }) {
  return (
    <div className="sticky top-0 z-30">
      <div className="bg-[#EEF3EE]/85 backdrop-blur-xl border-b border-black/5">
        <div className="max-w-5xl mx-auto px-4 h-[64px] flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-[180px]">
            <IconButton onClick={onHamburger} label="Menu">
              <MenuIcon />
            </IconButton>
            <div className="font-semibold text-[17px] tracking-tight text-slate-900">
              ElimuLink Connect
            </div>
          </div>

          <button
            className="flex items-center gap-2 px-3 py-2 rounded-2xl hover:bg-black/5 transition"
            aria-label="Month"
          >
            <span className="text-[22px] font-semibold tracking-tight text-slate-900">
              {monthLabel}
            </span>
            <span className="text-slate-500 -mt-[2px]">
              <DropIcon />
            </span>
          </button>

          <div className="flex items-center gap-1 min-w-[180px] justify-end">
            <IconButton label="Search">
              <SearchIcon />
            </IconButton>

            <IconButton onClick={onToday} label="Today">
              <TodayIcon />
            </IconButton>

            <button
              onClick={async () => {
                await signOut();
                window.location.href = "/login";
              }}
              className="ml-2 w-10 h-10 rounded-full bg-[#5B5ED9] text-white grid place-items-center font-semibold shadow-sm overflow-hidden"
              aria-label="Profile"
              title={user?.email || "Profile"}
            >
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                (user?.name || user?.email || "V").slice(0, 1).toUpperCase()
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}