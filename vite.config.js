import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, "");
  const missing = [
    "VITE_FIREBASE_API_KEY",
    "VITE_FIREBASE_AUTH_DOMAIN",
    "VITE_FIREBASE_DATABASE_URL",
    "VITE_FIREBASE_PROJECT_ID",
    "VITE_FIREBASE_APP_ID",
  ].filter((key) => !env[key]);

  if (missing.length) {
    console.warn(
      `[sungkhar] Missing env in ${path.join(root, ".env")}: ${missing.join(", ")}`
    );
  }

  return {
    root,
    envDir: root,
    plugins: [react()],
  };
});
