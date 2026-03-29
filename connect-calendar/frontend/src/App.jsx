import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppGate from "./components/AppGate.jsx";
import { useFamilyBootstrap } from "./auth/useFamilyBootstrap.js";
import Login from "./pages/Login.jsx";
import Calendar from "./pages/Calendar.jsx";
import CreateItem from "./pages/CreateItem.jsx";
import { observeAuth } from "./lib/auth.js";

function RequireAuth({ children, user }) {
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const bypassAuth = import.meta.env.VITE_BYPASS_CALENDAR_AUTH === "true";
  const bypassUser = bypassAuth
    ? {
        uid: "local-calendar-dev",
        email: "calendar-dev@localhost",
        name: "Calendar Dev",
        photoURL: null,
      }
    : null;
  const [user, setUser] = useState(bypassUser);
  const { bootState } = useFamilyBootstrap({
    appName: "calendar",
    verifyUrl:
      import.meta.env.VITE_CONNECT_VERIFY_URL ||
      (import.meta.env.DEV
        ? "http://localhost:8000/api/auth/verify-app-access"
        : "/api/auth/verify-app-access"),
  });
  const effectiveBootState = bypassAuth ? "ready" : bootState;

  useEffect(() => {
    if (bypassAuth) return undefined;
    const unsub = observeAuth((nextUser) => setUser(nextUser));
    return () => unsub?.();
  }, [bypassAuth]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/calendar" replace />} />
        <Route
          path="/login"
          element={
            effectiveBootState === "ready" ? (
              <Navigate to="/calendar" replace />
            ) : (
              <AppGate bootState={effectiveBootState}>
                <Login />
              </AppGate>
            )
          }
        />
        <Route
          path="/calendar"
          element={
            <AppGate bootState={effectiveBootState}>
              <RequireAuth user={user}>
                <Calendar userProfile={user} />
              </RequireAuth>
            </AppGate>
          }
        />
        <Route
          path="/create"
          element={
            <AppGate bootState={effectiveBootState}>
              <RequireAuth user={user}>
                <CreateItem />
              </RequireAuth>
            </AppGate>
          }
        />
        <Route path="*" element={<Navigate to="/calendar" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
