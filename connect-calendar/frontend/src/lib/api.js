import { getIdToken } from "./auth.js";

const BASE = "http://localhost:8000/api/v1";

async function request(path, { method = "GET", body } = {}) {
  const token = await getIdToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `API error ${res.status}`);
  }

  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return await res.json();
  return await res.text();
}

export const apiGet = (p) => request(p);
export const apiPost = (p, b) => request(p, { method: "POST", body: b });
export const apiPatch = (p, b) => request(p, { method: "PATCH", body: b });
export const apiDelete = (p) => request(p, { method: "DELETE" });