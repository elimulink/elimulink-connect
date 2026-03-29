import { useEffect, useState } from "react";
import { clearAppSession, loadAppSession, saveAppSession } from "./appSession";
import {
  getFirebaseIdToken,
  logoutFirebase,
  watchFirebaseAuth,
} from "./firebaseAuth";

export function useFamilyBootstrap({ appName, verifyUrl }) {
  const [bootState, setBootState] = useState("loading");
  const [profile, setProfile] = useState(() => loadAppSession());

  useEffect(() => {
    let active = true;

    const unsubscribe = watchFirebaseAuth(async (firebaseUser) => {
      if (!active) return;

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

        const res = await fetch(verifyUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ app: appName }),
        });

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
