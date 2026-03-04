import React, { useState } from "react";
import { signInGoogle } from "../lib/auth.js";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  return (
    <div className="min-h-screen bg-[#EEF3EE] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-[28px] bg-white/60 backdrop-blur border border-black/5 shadow-[0_14px_60px_rgba(0,0,0,0.08)] p-6">
        <div className="text-[18px] font-semibold text-slate-900 tracking-tight">
          ElimuLink Connect
        </div>
        <div className="mt-1 text-slate-600 text-sm">
          Sign in to access your Calendar.
        </div>

        {err ? (
          <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {err}
          </div>
        ) : null}

        <button
          disabled={loading}
          onClick={async () => {
            setErr("");
            setLoading(true);
            try {
              await signInGoogle();
              nav("/calendar");
            } catch (e) {
              setErr(String(e.message || e));
            } finally {
              setLoading(false);
            }
          }}
          className="mt-6 w-full rounded-2xl bg-[#2F6B58] text-white font-semibold py-3 shadow-sm hover:opacity-95 transition"
        >
          {loading ? "Signing in..." : "Continue with Google"}
        </button>

        <div className="mt-4 text-xs text-slate-500 leading-relaxed">
          Uses Firebase Auth. Your backend must accept the Firebase ID token.
        </div>
      </div>
    </div>
  );
}