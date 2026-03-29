import { getRedirectResult, onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../lib/firebase.js";

getRedirectResult(auth).catch((error) => {
  console.error("[family-auth] redirect result failed", {
    code: error?.code || "unknown",
    message: error?.message || String(error),
  });
});

export function watchFirebaseAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export function getFirebaseUser() {
  return auth.currentUser;
}

export async function getFirebaseIdToken(forceRefresh = false) {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}

export async function logoutFirebase() {
  await signOut(auth);
}
