import { auth, googleProvider } from "./firebase.js";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
} from "firebase/auth";

const CACHE_KEY = "connect_user_cache_v1";

export function getCachedUser() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCachedUser(u) {
  if (!u) {
    localStorage.removeItem(CACHE_KEY);
    return;
  }
  localStorage.setItem(CACHE_KEY, JSON.stringify(u));
}

export function observeAuth(cb) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      setCachedUser(null);
      cb?.(null);
      return;
    }
    const profile = {
      uid: user.uid,
      email: user.email,
      name: user.displayName,
      photoURL: user.photoURL,
    };
    setCachedUser(profile);
    cb?.(profile);
  });
}

export async function signInGoogle() {
  const res = await signInWithPopup(auth, googleProvider);
  const user = res.user;
  const profile = {
    uid: user.uid,
    email: user.email,
    name: user.displayName,
    photoURL: user.photoURL,
  };
  setCachedUser(profile);
  return profile;
}

export async function signOut() {
  await fbSignOut(auth);
  setCachedUser(null);
}

export async function getIdToken() {
  const u = auth.currentUser;
  if (!u) return null;
  return await u.getIdToken(true);
}