import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from "firebase/auth";
import { auth, firebaseConfigError, isFirebaseConfigured } from "./firebase";

const AuthContext = createContext(null);

const ADMIN_EMAILS = String(
  import.meta.env.VITE_ADMIN_EMAILS || import.meta.env.VITE_ADMIN_EMAIL || ""
)
  .replace(/^\uFEFF/, "")
  .replace(/\r/g, "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export function isAuthorizedEmail(email) {
  if (!email) return false;
  if (ADMIN_EMAILS.length === 0) return false;
  return ADMIN_EMAILS.includes(String(email).trim().toLowerCase());
}

function authMessage(code, fallback) {
  const map = {
    "auth/popup-closed-by-user": "Google sign-in was closed before it finished.",
    "auth/popup-blocked": "The browser blocked the Google window. Trying redirect…",
    "auth/cancelled-popup-request": "Google sign-in was cancelled.",
    "auth/operation-not-allowed": "Enable the Google provider in Firebase Authentication.",
    "auth/configuration-not-found":
      "Firebase Auth is not set up for this API key/project. Use the full Web config from the same Firebase app, enable Authentication → Google, and keep localhost in Authorized domains.",
    "auth/unauthorized-domain": "Add this site to Authorized domains in Firebase Authentication.",
    "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
      "This Firebase API key is rejected by Google. In Firebase Console → Project settings → Your apps, copy a fresh Web app config into .env (especially VITE_FIREBASE_API_KEY), enable Identity Toolkit API in Google Cloud, and remove API-key restrictions that block localhost.",
    "auth/invalid-api-key":
      "This Firebase API key is rejected by Google. Copy a fresh Web config from Firebase Project settings into .env and restart the dev server.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/user-not-found": "Email or password is incorrect.",
    "auth/wrong-password": "Email or password is incorrect.",
  };
  return map[code] || fallback;
}

async function assertAdmin(user) {
  if (isAuthorizedEmail(user?.email)) return;
  if (auth) await signOut(auth);
  throw new Error("This Gmail is not an authorized Admin. Guests stay read-only.");
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(!isFirebaseConfigured);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setReady(true);
      return undefined;
    }

    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) await assertAdmin(result.user);
      })
      .catch(() => {});

    const unsub = onAuthStateChanged(auth, async (next) => {
      if (next && !isAuthorizedEmail(next.email)) {
        await signOut(auth);
        setUser(null);
        setReady(true);
        return;
      }
      setUser(next);
      setReady(true);
    });
    return unsub;
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAdmin: Boolean(user) && isAuthorizedEmail(user.email),
      ready,
      error,
      configured: isFirebaseConfigured,
      allowlist: ADMIN_EMAILS,
      async login(email, password) {
        setError("");
        if (!isFirebaseConfigured) {
          throw new Error("Firebase is connected from .env. Use Sign in with Google.");
        }
        try {
          const cred = await signInWithEmailAndPassword(auth, email, password);
          await assertAdmin(cred.user);
        } catch (err) {
          if (err?.message?.includes("not an authorized")) throw err;
          throw new Error(authMessage(err?.code, err?.message || "Sign-in failed"));
        }
      },
      async loginWithGoogle() {
        setError("");
        if (!isFirebaseConfigured) {
          throw new Error(firebaseConfigError());
        }
        const provider = new GoogleAuthProvider();
        provider.addScope("email");
        provider.setCustomParameters({ prompt: "select_account" });
        try {
          const cred = await signInWithPopup(auth, provider);
          await assertAdmin(cred.user);
        } catch (err) {
          if (err?.message?.includes("not an authorized")) throw err;
          if (err?.code === "auth/popup-blocked") {
            await signInWithRedirect(auth, provider);
            return;
          }
          throw new Error(authMessage(err?.code, err?.message || "Google sign-in failed"));
        }
      },
      async logout() {
        if (!isFirebaseConfigured) {
          setUser(null);
          return;
        }
        await signOut(auth);
      },
    }),
    [user, ready, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
