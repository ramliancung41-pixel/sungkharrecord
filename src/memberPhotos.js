import { useEffect, useState } from "react";
import { onValue, ref, remove, set } from "firebase/database";
import { db, isFirebaseConfigured } from "./firebase";

/** Kept outside `sungkhar/` so the main live listener does not download every portrait. */
const PHOTO_ROOT = "sungkharPhotos";

const cache = new Map();
const listeners = new Set();

function cacheKey(id, version) {
  return `${id}:${version || ""}`;
}

function notify() {
  for (const fn of listeners) fn();
}

export function primePhoto(id, version, dataUrl) {
  cache.set(cacheKey(id, version), dataUrl);
  notify();
}

function driveFileId(url) {
  const byPath = url.match(/\/file\/d\/([\w-]{10,})/);
  if (byPath) return byPath[1];
  const byQuery = url.match(/[?&]id=([\w-]{10,})/);
  return byQuery ? byQuery[1] : "";
}

/** Turns pasted links into something an <img> can render (Google Drive share links included). */
export function normalizePhotoUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(value)) return value;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return "";
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
  if (/(^|\.)drive\.google\.com$/i.test(parsed.hostname)) {
    const id = driveFileId(value);
    return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w1000` : "";
  }
  return parsed.href;
}

export function describePhotoLink(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (normalizePhotoUrl(value)) return "";
  if (/drive\.google\.com/i.test(value)) {
    return "This Google Drive link is not a shared file. Open the photo in Drive, choose Share → Anyone with the link, then copy that link.";
  }
  return "This is not an image link. Upload the photo instead, or paste a link that starts with https://";
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("This image could not be read. Try a JPG or PNG photo."));
    img.src = src;
  });
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not open this file."));
    reader.readAsDataURL(file);
  });
}

function draw(img, width, height, crop) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0b0d14";
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, width, height);
  return canvas;
}

function coverCrop(img, aspect) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (w / h > aspect) {
    const cw = h * aspect;
    return { x: (w - cw) / 2, y: 0, w: cw, h };
  }
  const ch = w / aspect;
  return { x: 0, y: Math.max(0, (h - ch) * 0.35), w, h: ch };
}

/**
 * Resizes a picked file (or pasted data URL) into a 4:5 portrait and a small square thumbnail,
 * both JPEG data URLs small enough to store in the Realtime Database.
 */
export async function preparePortrait(source) {
  const src = typeof source === "string" ? source : await readFile(source);
  const img = await loadImage(src);
  if (!img.naturalWidth || !img.naturalHeight) throw new Error("This image is empty.");

  let width = 560;
  let quality = 0.84;
  let portrait = "";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const canvas = draw(img, width, Math.round(width * 1.25), coverCrop(img, 0.8));
    portrait = canvas.toDataURL("image/jpeg", quality);
    if (portrait.length <= 240_000) break;
    width = Math.round(width * 0.82);
    quality = Math.max(0.6, quality - 0.06);
  }
  const thumb = draw(img, 96, 96, coverCrop(img, 1)).toDataURL("image/jpeg", 0.72);
  return { portrait, thumb };
}

/** Landscape 16:9 cover for an article, kept small enough to live inside the article record. */
export async function prepareCover(source) {
  const src = typeof source === "string" ? source : await readFile(source);
  const img = await loadImage(src);
  let width = 1120;
  let quality = 0.8;
  let cover = "";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    cover = draw(img, width, Math.round((width * 9) / 16), coverCrop(img, 16 / 9)).toDataURL(
      "image/jpeg",
      quality
    );
    if (cover.length <= 180_000) break;
    width = Math.round(width * 0.82);
    quality = Math.max(0.58, quality - 0.06);
  }
  return cover;
}

export async function savePortrait(memberId, portrait, version) {
  primePhoto(memberId, version, portrait);
  if (!isFirebaseConfigured) return;
  await set(ref(db, `${PHOTO_ROOT}/${memberId}`), { data: portrait, updatedAt: version });
}

export async function deletePortrait(memberId) {
  if (!isFirebaseConfigured) return;
  await remove(ref(db, `${PHOTO_ROOT}/${memberId}`));
}

/** Full-size portrait for one member: uploaded photo first, then a pasted link. */
export function useMemberPhoto(member) {
  const id = member?.id || "";
  const version = member?.photoUpdatedAt || "";
  const link = normalizePhotoUrl(member?.photo);
  const key = cacheKey(id, version);
  const [, force] = useState(0);

  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);

  useEffect(() => {
    if (!id || !version || !isFirebaseConfigured || cache.has(key)) return undefined;
    return onValue(ref(db, `${PHOTO_ROOT}/${id}`), (snap) => {
      const data = snap.val()?.data;
      if (typeof data === "string" && data.startsWith("data:image/")) {
        cache.set(key, data);
        notify();
      }
    });
  }, [id, version, key]);

  if (version && cache.has(key)) return cache.get(key);
  return link || (version ? member?.photoThumb || "" : "");
}

export function memberThumb(member) {
  return member?.photoThumb || normalizePhotoUrl(member?.photo) || "";
}
