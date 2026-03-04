import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login.jsx";
import Lobby from "./pages/Lobby.jsx";
import PreJoin from "./pages/PreJoin.jsx";
import Room from "./pages/Room.jsx";
import { useAuth } from "./lib/auth.js";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center text-slate-600">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Protected><Lobby /></Protected>} />
        <Route path="/meet/:roomId" element={<Protected><PreJoin /></Protected>} />
        <Route path="/room/:roomId" element={<Protected><Room /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}