const ALLOWED = /(^|\.)(facebook\.com|fb\.com|fb\.watch)$/i;
const CRAWLER_UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";

function allowed(raw) {
  try {
    const url = new URL(raw);
    return (url.protocol === "https:" || url.protocol === "http:") && ALLOWED.test(url.hostname) ? url : null;
  } catch {
    return null;
  }
}

/** Facebook sometimes bounces anonymous requests to /login/?next=<real page>; unwrap that. */
function unwrapLogin(href) {
  const url = new URL(href);
  if (!/^\/login/i.test(url.pathname)) return href;
  const next = url.searchParams.get("next");
  return next && allowed(next) ? next : href;
}

function clean(href) {
  const url = new URL(unwrapLogin(href));
  for (const key of ["rdid", "share_url", "_rdc", "_rdr", "mibextid", "ref"]) url.searchParams.delete(key);
  return url.href;
}

export default async function handler(req, res) {
  const start = allowed(String(req.query?.url || ""));
  if (!start) {
    res.status(400).json({ error: "Only Facebook links can be resolved." });
    return;
  }

  let current = start.href;
  try {
    for (let hop = 0; hop < 5; hop += 1) {
      const response = await fetch(current, {
        redirect: "manual",
        headers: { "user-agent": CRAWLER_UA, "accept-language": "en" },
      });
      const location = response.headers.get("location");
      if (response.status < 300 || response.status >= 400 || !location) break;
      const next = allowed(new URL(location, current).href);
      if (!next) break;
      current = next.href;
      if (/^\/login/i.test(next.pathname)) break;
    }
  } catch {
    res.status(502).json({ error: "Facebook could not be reached." });
    return;
  }

  res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
  res.status(200).json({ url: clean(current) });
}
