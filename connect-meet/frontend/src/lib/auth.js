import React from "react";
import { auth } from "./firebase";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged
} from "firebase/auth";

const AuthCtx = React.createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await fbSignOut(auth);
  };

  return React.createElement(
    AuthCtx.Provider,
    { value: { user, loading, login, logout } },
    children
  );
}

export function useAuth() {
  return React.useContext(AuthCtx) || { user: null, loading: true };
}

export async function getIdToken() {
  const u = auth.currentUser;
  if (!u) return null;
  return await u.getIdToken();
}

export function getCurrentUser() {
  return auth.currentUser;
}

export async function signOut() {
  await fbSignOut(auth);
}