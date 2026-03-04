import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login.jsx";
import Calendar from "./pages/Calendar.jsx";
import CreateItem from "./pages/CreateItem.jsx";
import { observeAuth, getCachedUser } from "./lib/auth.js";

function RequireAuth({ children }) {
  const user = getCachedUser();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsub = observeAuth(() => setTick((t) => t + 1));
    return () => unsub?.();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/calendar" replace />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/calendar"
          element={
            <RequireAuth>
              <Calendar />
            </RequireAuth>
          }
        />
        <Route
          path="/create"
          element={
            <RequireAuth>
              <CreateItem />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/calendar" replace />} />
      </Routes>
    </BrowserRouter>
  );
}