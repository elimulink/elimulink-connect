import { useEffect, useState } from "react";
import { clearAppSession, loadAppSession, saveAppSession } from "./appSession";
import {
  getFirebaseIdToken,
  logoutFirebase,
  watchFirebaseAuth,
} from "./firebaseAuth";

const CALENDAR_BOOTSTRAP_TIMEOUT_MS = 8000;
const CALENDAR_INITIAL_AUTH_GRACE_MS = 2500;

export function useFamilyBootstrap({ appName, verifyUrl }) {
  const [bootState, setBootState] = useState("loading");
  const [profile, setProfile] = useState(() => loadAppSession());

  useEffect(() => {
    let active = true;
    let initialAuthResolved = false;
    const initialAuthTimer = setTimeout(() => {
      if (!active || initialAuthResolved) return;
      console.warn("[family-auth] calendar auth state timed out before initialization; falling back to guest");
      clearAppSession();
      setProfile(null);
      setBootState("guest");
    }, CALENDAR_INITIAL_AUTH_GRACE_MS);

    const unsubscribe = watchFirebaseAuth(async (firebaseUser) => {
      if (!active) return;
      initialAuthResolved = true;
      clearTimeout(initialAuthTimer);

      if (!firebaseUser) {
        clearAppSession();
        setProfile(null);
        setBootState("guest");
        return;
      }

      try {
        const token = await getFirebaseIdToken(true);
        if (!token) {
          throw new Error("Missing Firebase ID token");
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CALENDAR_BOOTSTRAP_TIMEOUT_MS);

        let res;
        try {
          res = await fetch(verifyUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ app: appName }),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (!res.ok) {
          throw new Error(`Verification failed with status ${res.status}`);
        }

        const data = await res.json();

        if (!data?.allowed || !Array.isArray(data.app_access) || !data.app_access.includes(appName)) {
          clearAppSession();
          setProfile(null);
          setBootState("denied");
          return;
        }

        const session = {
          ...data,
          app: appName,
          checked_at: new Date().toISOString(),
        };
        saveAppSession(session);
        setProfile(session);
        setBootState("ready");
      } catch (error) {
        console.error("[family-auth] calendar bootstrap failed", error);
        clearAppSession();
        setProfile(null);
        setBootState("guest");
      }
    });

    return () => {
      active = false;
      clearTimeout(initialAuthTimer);
      unsubscribe();
    };
  }, [appName, verifyUrl]);

  async function signOutApp() {
    clearAppSession();
    setProfile(null);
    await logoutFirebase();
    setBootState("guest");
  }

  return {
    bootState,
    profile,
    signOutApp,
  };
}
