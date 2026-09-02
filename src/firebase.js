import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getDatabase } from "firebase/database";

function env(name) {
  const raw = import.meta.env[name];
  if (raw == null) return "";
  return String(raw)
    .replace(/^\uFEFF/, "")
    .replace(/\r/g, "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

const firebaseConfig = {
  apiKey: env("VITE_FIREBASE_API_KEY"),
  authDomain: env("VITE_FIREBASE_AUTH_DOMAIN"),
  databaseURL: env("VITE_FIREBASE_DATABASE_URL"),
  projectId: env("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: env("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: env("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: env("VITE_FIREBASE_APP_ID"),
  measurementId: env("VITE_FIREBASE_MEASUREMENT_ID"),
};

const missingKeys = Object.entries({
  VITE_FIREBASE_API_KEY: firebaseConfig.apiKey,
  VITE_FIREBASE_DATABASE_URL: firebaseConfig.databaseURL,
  VITE_FIREBASE_PROJECT_ID: firebaseConfig.projectId,
})
  .filter(([, value]) => !value)
  .map(([key]) => key);

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.databaseURL &&
    firebaseConfig.projectId &&
    firebaseConfig.apiKey.startsWith("AIza")
);

export function firebaseConfigError() {
  if (isFirebaseConfigured) return "";
  if (missingKeys.length) {
    return `Firebase keys missing: ${missingKeys.join(", ")}. Check .env in the project root and restart npm run dev.`;
  }
  if (firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("AIza")) {
    return "VITE_FIREBASE_API_KEY looks invalid. Copy a fresh key from Firebase Console.";
  }
  return "Firebase is not configured. Add VITE_FIREBASE_* keys to .env and restart the dev server.";
}

let app = null;
export let auth = null;
export let db = null;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getDatabase(app);
  setPersistence(auth, browserLocalPersistence).catch(() => {});
} else if (import.meta.env.DEV) {
  console.warn("[sungkhar]", firebaseConfigError());
}
