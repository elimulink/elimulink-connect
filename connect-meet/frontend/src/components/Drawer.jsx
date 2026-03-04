import React from "react";

export default function Drawer({ open, onClose, user }) {
  return (
    <>
      <div
        className={`fixed inset-0 z-40 transition ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
        style={{ background: "rgba(15,23,42,.25)" }}
      />
      <div
        className={`fixed left-0 top-0 z-50 h-full w-[320px] transition-transform ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="h-full glass p-4">
          <div className="flex items-center justify-between px-2 py-2">
            <div className="font-semibold">Menu</div>
            <button className="iconBtn" onClick={onClose} aria-label="close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6L6 18" stroke="rgba(15,23,42,.75)" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          <div className="mt-2 glass2 rounded-2xl p-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-[rgba(47,111,87,.18)] grid place-items-center font-bold text-[rgba(47,111,87,.95)]">
                {user?.displayName?.[0]?.toUpperCase() || "U"}
              </div>
              <div className="min-w-0">
                <div className="font-semibold truncate">{user?.displayName || "User"}</div>
                <div className="text-sm text-slate-600 truncate">{user?.email || ""}</div>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <div className="text-sm font-semibold text-slate-600 px-2">Connect Meet</div>
            {[
              "Home",
              "Recent",
              "Settings",
              "Help & feedback"
            ].map((x) => (
              <button
                key={x}
                className="w-full text-left px-3 py-3 rounded-2xl hover:bg-[rgba(255,255,255,.55)] border border-transparent hover:border-[rgba(15,23,42,.08)]"
              >
                {x}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}