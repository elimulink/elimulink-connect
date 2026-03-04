import React from "react";

function Row({ children }) {
  return <div className="px-4 py-3 flex items-center justify-between">{children}</div>;
}

function Toggle({ checked, onChange, color = "#2F6B58" }) {
  return (
    <button
      onClick={() => onChange?.(!checked)}
      className={
        "w-6 h-6 rounded-md border grid place-items-center transition " +
        (checked ? "bg-white border-black/10" : "bg-white/60 border-black/10")
      }
      aria-label="Toggle"
      type="button"
    >
      {checked ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M20 6 9 17l-5-5" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ) : null}
    </button>
  );
}

export default function Drawer({ open, onClose, enabled, setEnabled, user }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/10" onClick={onClose} />

      <div className="absolute left-0 top-0 h-full w-[320px] max-w-[88vw] bg-[#EAF0EA]/90 backdrop-blur-xl border-r border-black/5 shadow-[10px_0_40px_rgba(0,0,0,0.06)]">
        <div className="px-4 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-slate-200 border border-black/5 overflow-hidden grid place-items-center">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="font-semibold text-slate-700">
                  {(user?.name || user?.email || "V").slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <div className="leading-tight">
              <div className="font-semibold text-slate-900 text-[15px]">
                {user?.name || "Victor Mumo"}
              </div>
              <div className="text-slate-600 text-[13px]">
                {user?.email || "victor@example.com"}
              </div>
            </div>
          </div>
        </div>

        <div className="h-px bg-black/5" />

        <Row>
          <div className="font-semibold text-slate-800">Calendar</div>
          <span className="text-slate-500">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        </Row>

        <div className="space-y-1 px-2 pb-2">
          <div className="rounded-2xl bg-white/55 border border-black/5">
            <div className="px-3 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Toggle checked={enabled.my} onChange={(v) => setEnabled((p) => ({ ...p, my: v }))} color="#2F6B58" />
                <div className="text-[14px] text-slate-900 font-medium">My calendar</div>
              </div>
              <span className="w-2 h-2 rounded-full bg-[#2F6B58]/25" />
            </div>

            <div className="h-px bg-black/5 mx-3" />

            <div className="px-3 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Toggle checked={enabled.tasks} onChange={(v) => setEnabled((p) => ({ ...p, tasks: v }))} color="#4F7BD9" />
                <div className="text-[14px] text-slate-900 font-medium">Tasks</div>
              </div>
              <span className="w-2 h-2 rounded-full bg-[#2F6B58]/25" />
            </div>
          </div>

          <div className="rounded-2xl bg-white/40 border border-black/5 opacity-70">
            <div className="px-3 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-md border border-black/10 bg-white/60" />
                <div className="text-[14px] text-slate-700 font-medium">Birthdays</div>
              </div>
              <span className="text-slate-400 text-xs">disabled</span>
            </div>

            <div className="h-px bg-black/5 mx-3" />

            <div className="px-3 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-md border border-black/10 bg-white/60" />
                <div className="text-[14px] text-slate-700 font-medium">Holidays</div>
              </div>
              <span className="text-slate-400 text-xs">disabled</span>
            </div>
          </div>
        </div>

        <div className="h-px bg-black/5" />

        <div className="px-4 py-3 space-y-3">
          <button className="w-full flex items-center gap-3 text-slate-700 hover:text-slate-900 transition">
            <span className="w-9 h-9 rounded-2xl bg-white/55 border border-black/5 grid place-items-center">??</span>
            <span className="font-medium">Settings</span>
          </button>

          <button className="w-full flex items-center gap-3 text-slate-700 hover:text-slate-900 transition">
            <span className="w-9 h-9 rounded-2xl bg-white/55 border border-black/5 grid place-items-center">?</span>
            <span className="font-medium">Help & feedback</span>
          </button>
        </div>
      </div>
    </div>
  );
}