import React from "react";

export default function BottomSheet({ open, onClose, children }) {
  return (
    <>
      <div
        className={`fixed inset-0 z-40 transition ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
        style={{ background: "rgba(15,23,42,.25)" }}
      />
      <div
        className={`fixed inset-x-0 bottom-0 z-50 transition-transform ${open ? "translate-y-0" : "translate-y-full"}`}
      >
        <div className="mx-auto max-w-[540px] glass rounded-t-3xl p-4 pb-6">
          <div className="mx-auto h-1.5 w-12 rounded-full bg-[rgba(15,23,42,.15)] mb-4" />
          {children}
        </div>
      </div>
    </>
  );
}