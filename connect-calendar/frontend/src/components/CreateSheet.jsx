import React from "react";
import { useNavigate } from "react-router-dom";

function Pill({ label, icon, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={
        "w-full flex items-center gap-4 px-6 py-4 rounded-[999px] border transition text-left shadow-sm " +
        (disabled
          ? "bg-white/35 border-black/5 text-slate-400"
          : "bg-[#EAF3EA] border-black/5 hover:bg-[#E2EFE2] active:scale-[0.995] text-slate-900")
      }
    >
      <span className="w-9 h-9 rounded-full bg-white/70 border border-black/5 grid place-items-center text-lg">
        {icon}
      </span>
      <span className="text-[16px] font-semibold tracking-tight">{label}</span>
    </button>
  );
}

export default function CreateSheet({ open, onClose }) {
  const nav = useNavigate();
  if (!open) return null;

  const go = (kind) => {
    onClose?.();
    nav(`/create?kind=${encodeURIComponent(kind)}`);
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/10" onClick={onClose} />

      <div className="absolute bottom-[112px] right-6 w-[320px] max-w-[82vw] space-y-3">
        <Pill label="Event" icon="??" onClick={() => go("EVENT")} />
        <Pill label="Task" icon="?" onClick={() => go("TASK")} />
        <Pill label="Working location" icon="??" onClick={() => go("WORKING_LOCATION")} />
        <Pill label="Out of office" icon="???" onClick={() => go("OUT_OF_OFFICE")} />
        <Pill label="Birthday" icon="??" disabled />
      </div>

      <button
        onClick={onClose}
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-[#2F6B58] text-white shadow-[0_14px_30px_rgba(0,0,0,0.20)] grid place-items-center text-3xl"
        aria-label="Close"
      >
        ×
      </button>
    </div>
  );
}