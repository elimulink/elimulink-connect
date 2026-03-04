import React from "react";

export default function TopBar({ title, onMenu, right }) {
  return (
    <div className="flex items-center justify-between px-5 py-4">
      <div className="flex items-center gap-3">
        <button className="iconBtn" onClick={onMenu} aria-label="menu">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M4 6h16M4 12h16M4 18h16" stroke="rgba(15,23,42,.75)" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <span className="h-8 w-8 rounded-full bg-[rgba(47,111,87,.14)] grid place-items-center">
            <span className="h-3 w-3 rounded-full bg-[rgba(47,111,87,.9)]"></span>
          </span>
          <div className="font-semibold tracking-tight">{title}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">{right}</div>
    </div>
  );
}