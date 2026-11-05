const FB_HOST = /(^|\.)(facebook\.com|fb\.com|fb\.watch)$/i;

function parse(raw) {
  try {
    const url = new URL(String(raw || "").trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url;
  } catch {
    return null;
  }
}

export function isFacebookUrl(raw) {
  const url = parse(raw);
  return Boolean(url && FB_HOST.test(url.hostname));
}

function canonical(url) {
  const next = new URL(url.href);
  next.protocol = "https:";
  if (!/fb\.watch$/i.test(next.hostname)) next.hostname = "www.facebook.com";
  for (const key of [...next.searchParams.keys()]) {
    if (!["v", "story_fbid", "id", "fbid"].includes(key)) next.searchParams.delete(key);
  }
  next.hash = "";
  return next.href;
}

/**
 * Classifies a Facebook link.
 * - video: a public video or reel that Facebook's player can embed
 * - post: a page post (may contain a video) that the post plugin can embed
 * - share: a short link (share/v, share/r, fb.watch) that must be resolved first
 * - group: group content, which Facebook never allows outside Facebook
 * - unsupported: a Facebook link that is not a video
 */
export function describeFacebookLink(raw) {
  const url = parse(raw);
  if (!url || !FB_HOST.test(url.hostname)) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  const first = (parts[0] || "").toLowerCase();

  if (first === "login" && url.searchParams.get("next")) {
    const inner = describeFacebookLink(url.searchParams.get("next"));
    if (inner) return inner;
  }
  if (/fb\.watch$/i.test(url.hostname)) return { kind: "share", href: url.href };
  if (first === "share") return { kind: "share", href: canonical(url) };
  if (first === "groups") return { kind: "group", href: canonical(url) };

  const v = url.searchParams.get("v");
  if ((first === "watch" || first === "video.php") && /^\d+$/.test(v || "")) {
    return { kind: "video", id: v, href: `https://www.facebook.com/watch/?v=${v}` };
  }
  if (first === "reel" && /^\d+$/.test(parts[1] || "")) {
    return { kind: "video", id: parts[1], vertical: true, href: `https://www.facebook.com/reel/${parts[1]}` };
  }
  const videosAt = parts.findIndex((p) => p.toLowerCase() === "videos");
  if (videosAt >= 0) {
    const id = parts.slice(videosAt + 1).find((p) => /^\d{6,}$/.test(p));
    if (id) return { kind: "video", id, href: canonical(url) };
  }
  if (parts.some((p) => p.toLowerCase() === "posts") || first === "permalink.php" || first === "story.php") {
    return { kind: "post", href: canonical(url) };
  }
  return { kind: "unsupported", href: canonical(url) };
}

export function facebookEmbedSrc(info) {
  if (!info) return "";
  const href = encodeURIComponent(info.href);
  if (info.kind === "video") {
    return `https://www.facebook.com/plugins/video.php?href=${href}&show_text=false&width=734&t=0`;
  }
  if (info.kind === "post") {
    return `https://www.facebook.com/plugins/post.php?href=${href}&show_text=true&width=500`;
  }
  return "";
}

export function facebookLinkHint(raw) {
  const info = describeFacebookLink(raw);
  if (!info) return "";
  if (info.kind === "video") return "Facebook video detected · it will play inside the app if the video is public.";
  if (info.kind === "post") return "Facebook post detected · it will be embedded if the post is public.";
  if (info.kind === "share") return "Facebook share link · the real video link is looked up when you save.";
  if (info.kind === "group") {
    return "Facebook group video · Facebook does not allow group videos to play outside Facebook, so visitors will get a “Watch on Facebook” button.";
  }
  return "This Facebook link is not a video. Open the video on Facebook, tap Share → Copy link, and paste that link.";
}

/** Follows a Facebook short link through the site's /api helper. Returns "" when it cannot. */
export async function resolveFacebookLink(raw, timeoutMs = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`/api/facebook-resolve?url=${encodeURIComponent(raw)}`, {
      signal: controller.signal,
    });
    if (!res.ok) return "";
    const body = await res.json();
    return typeof body.url === "string" && isFacebookUrl(body.url) ? body.url : "";
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}
