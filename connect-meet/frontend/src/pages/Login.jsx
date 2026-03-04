import React from "react";
import { useAuth } from "../lib/auth.js";
import { Navigate } from "react-router-dom";

export default function Login() {
  const { user, login } = useAuth();
  if (user) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen grid place-items-center px-5">
      <div className="w-full max-w-[520px] glass rounded-3xl p-7">
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 rounded-2xl bg-[rgba(47,111,87,.14)] grid place-items-center">
            <span className="h-3 w-3 rounded-full bg-[rgba(47,111,87,.9)]"></span>
          </span>
          <div>
            <div className="text-xl font-bold tracking-tight">ElimuLink Connect Meet</div>
            <div className="text-sm text-slate-600">Sign in to start or join meetings.</div>
          </div>
        </div>

        <div className="mt-6 grid gap-3">
          <button className="btnPrimary" onClick={login}>
            Continue with Google
          </button>
          <div className="text-xs text-slate-500">
            By continuing, you agree to use a fictional demo environment for development.
          </div>
        </div>
      </div>
    </div>
  );
}