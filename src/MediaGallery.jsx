import { useMemo, useState } from "react";
import { useMedia } from "./MediaContext";

const TABS = [
  { id: "all", label: "All" },
  { id: "image", label: "Images" },
  { id: "video", label: "Videos" },
  { id: "audio", label: "MP3 / Audio" },
];

function formatWhen(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function youtubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.replace(/^\//, "").split("/")[0];
    if (u.hostname.includes("youtube.com")) {
      if (u.searchParams.get("v")) return u.searchParams.get("v");
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0] === "embed" || parts[0] === "shorts") return parts[1] || "";
    }
  } catch {
    /* ignore */
  }
  return "";
}

function vimeoId(url) {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("vimeo.com")) return "";
    const id = u.pathname.split("/").filter(Boolean).pop();
    return /^\d+$/.test(id || "") ? id : "";
  } catch {
    return "";
  }
}

function looksLikeImageUrl(url) {
  const path = String(url || "").split("?")[0].toLowerCase();
  return /\.(png|jpe?g|gif|webp|avif|svg|bmp)$/.test(path);
}

function PlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path fill="currentColor" d="M8 5.5v13l11-6.5L8 5.5z" />
    </svg>
  );
}

function MediaPreviewBody({ item }) {
  if (item.type === "image") {
    return <img src={item.url} alt={item.title} />;
  }
  if (item.type === "audio") {
    return (
      <div className="preview-audio">
        <div className="preview-audio-art" aria-hidden="true">
          <span>♪</span>
        </div>
        <audio src={item.url} controls />
      </div>
    );
  }
  const yt = youtubeId(item.url);
  if (yt) {
    return (
      <iframe
        title={item.title}
        src={`https://www.youtube.com/embed/${yt}`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }
  const vim = vimeoId(item.url);
  if (vim) {
    return (
      <iframe
        title={item.title}
        src={`https://player.vimeo.com/video/${vim}`}
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    );
  }
  return <video src={item.url} controls playsInline />;
}

function RichThumb({ item }) {
  const [broken, setBroken] = useState(false);
  const yt = item.type === "video" ? youtubeId(item.url) : "";
  const vim = item.type === "video" ? vimeoId(item.url) : "";

  let poster = "";
  if (item.type === "image" || looksLikeImageUrl(item.url)) {
    poster = item.url;
  } else if (yt) {
    poster = `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`;
  } else if (vim) {
    poster = `https://vumbnail.com/${vim}.jpg`;
  }

  const showImage = Boolean(poster) && !broken;
  const kind = item.type || "image";

  return (
    <div className={`rich-thumb kind-${kind}`}>
      {showImage && (
        <img
          className="rich-thumb-media"
          src={poster}
          alt=""
          loading="lazy"
          onError={() => setBroken(true)}
        />
      )}
      {!showImage && kind === "video" && (
        <video
          className="rich-thumb-media"
          src={item.url}
          muted
          playsInline
          preload="metadata"
          onError={() => setBroken(true)}
        />
      )}
      {!showImage && kind !== "video" && (
        <div className="rich-thumb-fallback" aria-hidden="true">
          <span>{kind === "audio" ? "♪" : "◈"}</span>
        </div>
      )}
      <div className="rich-thumb-shade" />
      {(kind === "video" || kind === "audio") && (
        <span className="rich-play" aria-hidden="true">
          <PlayGlyph />
        </span>
      )}
      <span className={`rich-badge ${kind}`}>{kind}</span>
    </div>
  );
}

export default function MediaGallery({ compact = false }) {
  const { items, addMediaLink, updateMediaLink, deleteMedia, saving, error, isAdmin } = useMedia();
  const [tab, setTab] = useState("all");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState("image");
  const [editId, setEditId] = useState("");
  const [localError, setLocalError] = useState("");
  const [preview, setPreview] = useState(null);

  const filtered = useMemo(() => {
    if (tab === "all") return items;
    return items.filter((item) => item.type === tab);
  }, [items, tab]);

  const livePreview = useMemo(() => {
    if (!url.trim()) return null;
    return { id: "draft", title: title || "Preview", url: url.trim(), type };
  }, [url, title, type]);

  function resetForm() {
    setTitle("");
    setUrl("");
    setType("image");
    setEditId("");
    setLocalError("");
  }

  function startEdit(item) {
    setEditId(item.id);
    setTitle(item.title || "");
    setUrl(item.url || "");
    setType(item.type || "image");
    setLocalError("");
    if (!compact) {
      document.getElementById("media-manage")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setLocalError("");
    try {
      if (editId) {
        await updateMediaLink(editId, { url, title, type });
      } else {
        await addMediaLink({ url, title, type });
      }
      resetForm();
    } catch (err) {
      setLocalError(err.message || "Could not save link");
    }
  }

  return (
    <div className={`media-gallery-root ${compact ? "compact" : "page"}`}>
      {!compact && (
        <div className="panel-head wrap">
          <div>
            <p className="kicker">Archive</p>
            <h2>Family media</h2>
          </div>
          <span className="chip">{isAdmin ? "Admin · manage enabled" : "Open to view · read only"}</span>
        </div>
      )}

      <p className="hint">
        Everyone can preview and play images, videos, and audio.{" "}
        {isAdmin
          ? "As Admin you can add, edit, or delete links."
          : "Only signed-in Admins can add, edit, or delete."}
      </p>

      {isAdmin && (
        <form id="media-manage" className="media-upload glass" onSubmit={onSubmit}>
          <div className="panel-head">
            <h3>{editId ? "Edit media link" : "Add media link"}</h3>
            {editId && (
              <button className="btn ghost" type="button" onClick={resetForm}>
                Cancel edit
              </button>
            )}
          </div>
          <label className="media-title-field">
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Clan gathering 2024"
              disabled={saving}
            />
          </label>
          <label className="media-title-field">
            Media type
            <select value={type} onChange={(e) => setType(e.target.value)} disabled={saving}>
              <option value="image">Image</option>
              <option value="video">Video</option>
              <option value="audio">MP3 / Audio</option>
            </select>
          </label>
          <label className="media-title-field">
            External URL
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              required
              disabled={saving}
            />
          </label>

          {livePreview && (
            <div className="link-live-preview">
              <div className="link-live-thumb">
                <RichThumb key={`${livePreview.type}:${livePreview.url}`} item={livePreview} />
              </div>
              <div>
                <p className="kicker">Live preview</p>
                <strong>{livePreview.title}</strong>
                <p className="hint">This is how the card will look in the gallery.</p>
              </div>
            </div>
          )}

          <div className="row">
            <button className="btn gold" type="submit" disabled={saving}>
              {saving ? "Saving…" : editId ? "Update link" : "Save link"}
            </button>
          </div>
          {(localError || error) && <p className="error">{localError || error}</p>}
        </form>
      )}

      <div className="media-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            className={`media-tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            <em>{t.id === "all" ? items.length : items.filter((i) => i.type === t.id).length}</em>
          </button>
        ))}
      </div>

      <div className={`media-gallery ${compact ? "" : "media-gallery-grid"}`}>
        {!filtered.length && (
          <div className="media-empty glass">
            <p>
              {isAdmin
                ? "No media in this tab yet. Add a link above to begin the gallery."
                : "No media in this tab yet. Check back when a keeper adds photos, videos, or audio."}
            </p>
          </div>
        )}
        {filtered.map((item) => (
          <article key={item.id} className="media-card glass">
            <button
              type="button"
              className="media-thumb"
              onClick={() => setPreview(item)}
              aria-label={`Open ${item.title}`}
            >
              <RichThumb key={`${item.id}:${item.url}`} item={item} />
            </button>
            <div className="media-meta">
              <strong>{item.title}</strong>
              <span className="media-type-line">
                <em className={`pill-soft ${item.type}`}>{item.type}</em>
                tap to preview / play
              </span>
              <span>{formatWhen(item.createdAt || item.uploadedAt)}</span>
              <div className="card-actions">
                <button className="link" type="button" onClick={() => setPreview(item)}>
                  {item.type === "image" ? "View" : "Play"}
                </button>
                <a className="link" href={item.url} target="_blank" rel="noreferrer">
                  Open URL
                </a>
                {isAdmin && (
                  <>
                    <button className="link" type="button" onClick={() => startEdit(item)}>
                      Edit
                    </button>
                    <button
                      className="link danger"
                      type="button"
                      onClick={async () => {
                        if (!window.confirm(`Remove “${item.title}”?`)) return;
                        try {
                          await deleteMedia(item);
                          if (preview?.id === item.id) setPreview(null);
                          if (editId === item.id) resetForm();
                        } catch {
                          /* context error */
                        }
                      }}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      {preview && (
        <div className="media-preview-back" onClick={() => setPreview(null)}>
          <div className="media-preview glass" onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <h3>{preview.title}</h3>
              <button className="btn ghost" type="button" onClick={() => setPreview(null)}>
                Close
              </button>
            </div>
            <MediaPreviewBody item={preview} />
            <p className="muted url-break">
              <a href={preview.url} target="_blank" rel="noreferrer">
                {preview.url}
              </a>
            </p>
            {isAdmin && (
              <div className="row">
                <button className="btn ghost" type="button" onClick={() => startEdit(preview)}>
                  Edit
                </button>
                <button
                  className="btn ghost"
                  type="button"
                  onClick={async () => {
                    if (!window.confirm(`Remove “${preview.title}”?`)) return;
                    try {
                      await deleteMedia(preview);
                      setPreview(null);
                    } catch {
                      /* ignore */
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
