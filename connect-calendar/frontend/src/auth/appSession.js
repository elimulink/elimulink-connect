const SESSION_KEY = "elimulink_family_session";

export function saveAppSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function loadAppSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearAppSession() {
  localStorage.removeItem(SESSION_KEY);
}
