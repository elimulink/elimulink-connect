import React from "react";

export default function ParticipantsPanel({ dark, members = [], pending = [], hostUid, myUid, onAdmit, onRemove }) {
  const shell = dark ? "darkShell text-white" : "glass text-slate-900";
  const border = dark ? "border-white/10" : "border-slate-900/10";

  return (
    <div className={`h-full rounded-3xl ${shell} overflow-hidden`}>
      <div className={`px-4 py-4 flex items-center justify-between border-b ${border}`}>
        <div className="flex items-center gap-3">
          <button className={dark ? "iconBtnDark" : "iconBtn"} aria-label="menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M4 6h16M4 12h16M4 18h16" stroke={dark ? "rgba(255,255,255,.8)" : "rgba(15,23,42,.75)"} strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
          <div className="font-semibold">Participants</div>
        </div>
        <button className={dark ? "iconBtnDark" : "iconBtn"} aria-label="more">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M6 12h.01M12 12h.01M18 12h.01" stroke={dark ? "rgba(255,255,255,.8)" : "rgba(15,23,42,.75)"} strokeWidth="3" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      <div className="p-4 space-y-4 overflow-auto h-[calc(100%-80px)]">
        <div>
          <div className={`text-xs uppercase tracking-widest ${dark ? "text-white/50" : "text-slate-500"}`}>
            Members
          </div>
          <div className="mt-2 space-y-2">
            {members.map((m) => (
              <div key={m.uid} className={`flex items-center justify-between rounded-2xl px-3 py-2 ${dark ? "bg-white/5" : "bg-white/60"}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`h-9 w-9 rounded-full grid place-items-center font-bold ${dark ? "bg-white/10 text-white" : "bg-[rgba(47,111,87,.18)] text-[rgba(47,111,87,.95)]"}`}>
                    {(m.display_name || m.uid || "U")[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{m.display_name || m.uid}</div>
                    <div className={`text-xs ${dark ? "text-white/60" : "text-slate-500"}`}>
                      {m.uid === hostUid ? "Host" : "Member"}
                    </div>
                  </div>
                </div>
                {myUid === hostUid && m.uid !== myUid ? (
                  <button className={`text-xs ${dark ? "text-red-300" : "text-red-600"}`} onClick={() => onRemove?.(m.uid)}>
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
            {members.length === 0 ? (
              <div className={`text-sm ${dark ? "text-white/50" : "text-slate-500"}`}>No members yet.</div>
            ) : null}
          </div>
        </div>

        <div>
          <div className={`text-xs uppercase tracking-widest ${dark ? "text-white/50" : "text-slate-500"}`}>
            Waiting
          </div>
          <div className="mt-2 space-y-2">
            {pending.map((p) => (
              <div key={p.uid} className={`flex items-center justify-between rounded-2xl px-3 py-2 ${dark ? "bg-white/5" : "bg-white/60"}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`h-9 w-9 rounded-full grid place-items-center font-bold ${dark ? "bg-white/10 text-white" : "bg-[rgba(47,111,87,.18)] text-[rgba(47,111,87,.95)]"}`}>
                    {(p.display_name || p.uid || "U")[0]?.toUpperCase()}
                  </div>
                  <div className="font-semibold truncate">{p.display_name || p.uid}</div>
                </div>
                {myUid === hostUid ? (
                  <button className={`text-xs ${dark ? "text-emerald-300" : "text-emerald-700"}`} onClick={() => onAdmit?.(p.uid)}>
                    Admit
                  </button>
                ) : (
                  <span className={`text-xs ${dark ? "text-white/40" : "text-slate-400"}`}>Waiting</span>
                )}
              </div>
            ))}
            {pending.length === 0 ? (
              <div className={`text-sm ${dark ? "text-white/50" : "text-slate-500"}`}>No pending users.</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}