import { auth } from "./firebase";

export const API_BASE = "http://localhost:8000";

export async function getIdToken() {
  const u = auth.currentUser;
  if (!u) return null;
  return await u.getIdToken();
}

export async function wsUrl(roomId) {
  const token = await getIdToken();
  const qs = new URLSearchParams({ token: token || "" }).toString();
  return `${API_BASE.replace("http", "ws")}/ws/rooms/${roomId}?${qs}`;
}