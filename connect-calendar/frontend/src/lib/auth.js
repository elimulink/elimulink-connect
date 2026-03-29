import { auth, googleProvider } from "./firebase.js";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from "firebase/auth";
import { clearAppSession } from "../auth/appSession";
import { logoutFirebase } from "../auth/firebaseAuth";

let protectedAuthFailureInFlight = null;

export function observeAuth(cb) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      clearAppSession();
      cb?.(null);
      return;
    }
    const profile = {
      uid: user.uid,
      email: user.email,
      name: user.displayName,
      photoURL: user.photoURL,
    };
    cb?.(profile);
  });
}

getRedirectResult(auth)
  .then((res) => {
    if (res?.user) {
      console.info("[auth] redirect sign-in success", {
        uid: res.user.uid,
        email: res.user.email || null,
      });
    }
  })
  .catch((error) => {
    console.error("[auth] redirect sign-in failed", {
      code: error?.code || "unknown",
      message: error?.message || String(error),
      customData: error?.customData || null,
    });
  });

export async function signInGoogle() {
  console.info("[auth] signInWithPopup start");
  try {
    const res = await signInWithPopup(auth, googleProvider);
    const user = res.user;
    const profile = {
      uid: user.uid,
      email: user.email,
      name: user.displayName,
      photoURL: user.photoURL,
    };
    console.info("[auth] signInWithPopup success", {
      uid: user.uid,
      email: user.email || null,
    });
    return profile;
  } catch (error) {
    const code = error?.code || "unknown";
    console.error("[auth] signInWithPopup failed", {
      code,
      message: error?.message || String(error),
      customData: error?.customData || null,
    });

    if (
      code === "auth/popup-blocked" ||
      code === "auth/popup-closed-by-user" ||
      code === "auth/cancelled-popup-request"
    ) {
      console.warn("[auth] falling back to signInWithRedirect", { code });
      await signInWithRedirect(auth, googleProvider);
      return null;
    }

    throw error;
  }
}

export async function signOut() {
  clearAppSession();
  await logoutFirebase();
}

export async function getIdToken() {
  const u = auth.currentUser;
  if (!u) return null;
  return await u.getIdToken(true);
}

export async function handleProtectedAuthFailure() {
  if (protectedAuthFailureInFlight) return protectedAuthFailureInFlight;

  protectedAuthFailureInFlight = (async () => {
    clearAppSession();
    try {
      await logoutFirebase();
    } catch (error) {
      console.warn("[auth] protected auth failure cleanup failed", error);
    } finally {
      protectedAuthFailureInFlight = null;
    }
  })();

  return protectedAuthFailureInFlight;
}
