import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onValue, ref, remove, set, update } from "firebase/database";
import { db, isFirebaseConfigured } from "./firebase";
import { useAuth } from "./AuthContext";

const MediaContext = createContext(null);

const KINDS = new Set(["image", "video", "audio"]);

function newMediaId() {
  return `media_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function toList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return Object.values(value);
}

function normalizeUrl(raw) {
  const url = String(raw || "").trim();
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return parsed.href;
  } catch {
    return "";
  }
}

function guessKindFromUrl(url) {
  const path = url.split("?")[0].toLowerCase();
  if (/\.(png|jpe?g|gif|webp|avif|svg)$/.test(path)) return "image";
  if (/\.(mp4|webm|ogg|mov|m4v)$/.test(path)) return "video";
  if (/\.(mp3|wav|m4a|aac|ogg)$/.test(path)) return "audio";
  if (/youtube\.com|youtu\.be|vimeo\.com/.test(url)) return "video";
  return "";
}

export function MediaProvider({ children }) {
  const { isAdmin, user } = useAuth();
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setItems([]);
      return undefined;
    }
    const mediaRef = ref(db, "sungkhar/media");
    const unsub = onValue(
      mediaRef,
      (snap) => {
        const list = toList(snap.val()).sort(
          (a, b) => (b.createdAt || b.uploadedAt || 0) - (a.createdAt || a.uploadedAt || 0)
        );
        setItems(list);
      },
      () => setItems([])
    );
    return unsub;
  }, []);

  const value = useMemo(
    () => ({
      items,
      saving,
      error,
      isAdmin,
      async addMediaLink({ url, title = "", type = "" }) {
        setError("");
        if (!isAdmin) throw new Error("Only an Admin can add media links.");
        if (!isFirebaseConfigured) throw new Error("Firebase is not configured.");

        const href = normalizeUrl(url);
        if (!href) throw new Error("Enter a valid http(s) link.");

        const kind = KINDS.has(type) ? type : guessKindFromUrl(href);
        if (!kind) throw new Error("Choose a type: image, video, or audio.");

        const id = newMediaId();
        const meta = {
          id,
          title: String(title || "").trim() || href,
          name: href,
          type: kind,
          url: href,
          createdAt: Date.now(),
          uploadedAt: Date.now(),
          uploadedBy: user?.email || "",
          source: "external",
        };

        setSaving(true);
        try {
          await set(ref(db, `sungkhar/media/${id}`), meta);
          return meta;
        } catch (err) {
          setError(err.message || "Could not save media link.");
          throw err;
        } finally {
          setSaving(false);
        }
      },
      async updateMediaLink(id, { url, title = "", type = "" }) {
        setError("");
        if (!isAdmin) throw new Error("Only an Admin can edit media links.");
        if (!isFirebaseConfigured) throw new Error("Firebase is not configured.");
        if (!id) throw new Error("Missing media id.");

        const href = normalizeUrl(url);
        if (!href) throw new Error("Enter a valid http(s) link.");
        const kind = KINDS.has(type) ? type : guessKindFromUrl(href);
        if (!kind) throw new Error("Choose a type: image, video, or audio.");

        setSaving(true);
        try {
          await update(ref(db, `sungkhar/media/${id}`), {
            title: String(title || "").trim() || href,
            name: href,
            type: kind,
            url: href,
            updatedAt: Date.now(),
            updatedBy: user?.email || "",
          });
        } catch (err) {
          setError(err.message || "Could not update media link.");
          throw err;
        } finally {
          setSaving(false);
        }
      },
      async deleteMedia(item) {
        if (!isAdmin) throw new Error("Only an Admin can delete media.");
        if (!item?.id) return;
        setError("");
        try {
          await remove(ref(db, `sungkhar/media/${item.id}`));
        } catch (err) {
          setError(err.message || "Delete failed");
          throw err;
        }
      },
    }),
    [items, saving, error, isAdmin, user]
  );

  return <MediaContext.Provider value={value}>{children}</MediaContext.Provider>;
}

export function useMedia() {
  const ctx = useContext(MediaContext);
  if (!ctx) throw new Error("useMedia must be used within MediaProvider");
  return ctx;
}
