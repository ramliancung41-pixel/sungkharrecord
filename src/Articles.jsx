import { useEffect, useRef, useState } from "react";
import { ARTICLE_CATEGORIES } from "./ArticlesContext";
import { normalizePhotoUrl, prepareCover, describePhotoLink } from "./memberPhotos";

export function categoryLabel(id) {
  return ARTICLE_CATEGORIES.find((c) => c.id === id)?.label || "Family story";
}

export function formatDay(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export function readingMinutes(body) {
  const words = String(body || "").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function excerpt(article, length = 180) {
  const text = article.summary || String(article.body || "").replace(/^[#>-]+\s*/gm, "").replace(/\*\*|__|\*|_/g, "");
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > length ? `${flat.slice(0, length).replace(/\s\S*$/, "")}…` : flat;
}

/** Inline **bold**, *italic* and bare links, rendered as React nodes (never as HTML). */
function renderInline(text, keyBase) {
  const nodes = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*\n]+\*|https?:\/\/[^\s)]+)/g;
  let last = 0;
  let match;
  let i = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyBase}-${i++}`;
    if (token.startsWith("**")) nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith("*")) nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    else {
      nodes.push(
        <a key={key} href={token} target="_blank" rel="noreferrer">
          {token}
        </a>
      );
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function ArticleBody({ body }) {
  const blocks = String(body || "")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
    .flatMap((block) => {
      const [first, ...rest] = block.split("\n");
      return /^#{1,2}\s/.test(first) && rest.length ? [first, rest.join("\n")] : [block];
    });
  return (
    <div className="article-body">
      {blocks.map((block, index) => {
        const key = `b${index}`;
        if (block.startsWith("## ")) return <h4 key={key}>{renderInline(block.slice(3), key)}</h4>;
        if (block.startsWith("# ")) return <h3 key={key}>{renderInline(block.slice(2), key)}</h3>;
        if (block.split("\n").every((l) => l.startsWith(">"))) {
          return (
            <blockquote key={key}>
              {renderInline(block.replace(/^>\s?/gm, ""), key)}
            </blockquote>
          );
        }
        if (block.split("\n").every((l) => /^[-•]\s/.test(l))) {
          return (
            <ul key={key}>
              {block.split("\n").map((l, li) => (
                <li key={`${key}-${li}`}>{renderInline(l.replace(/^[-•]\s/, ""), `${key}-${li}`)}</li>
              ))}
            </ul>
          );
        }
        const lines = block.split("\n");
        return (
          <p key={key} className={index === 0 ? "lead" : ""}>
            {lines.map((line, li) => (
              <span key={`${key}-${li}`}>
                {li > 0 && <br />}
                {renderInline(line, `${key}-${li}`)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export function Cover({ src, alt, className = "" }) {
  const url = String(src || "").startsWith("data:image/") ? src : normalizePhotoUrl(src);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);
  if (!url || broken) {
    return (
      <div className={`article-cover empty ${className}`} aria-hidden="true">
        <span>Carelnak</span>
      </div>
    );
  }
  return (
    <div className={`article-cover ${className}`}>
      <img src={url} alt={alt} loading="lazy" onError={() => setBroken(true)} />
    </div>
  );
}

export function ArticleCard({ article, featured = false, draft = false, onOpen }) {
  return (
    <a
      href={`/carelnak/${article.id}`}
      className={`article-card ${featured ? "featured" : ""} ${draft ? "draft" : ""} ${
        article.cover ? "" : "no-cover"
      }`}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
        e.preventDefault();
        onOpen(article);
      }}
    >
      <Cover src={article.cover} alt="" />
      <span className="article-card-body">
        <span className="article-meta-line">
          <em>{categoryLabel(article.category)}</em>
          {draft ? <b className="draft-pill">Draft</b> : <span>{formatDay(article.publishedAt)}</span>}
        </span>
        <strong className="article-card-title">{article.title || "Untitled"}</strong>
        <span className="article-card-excerpt">{excerpt(article, featured ? 260 : 150)}</span>
        <span className="article-card-foot">
          {article.author && <span>By {article.author}</span>}
          <span>{readingMinutes(article.body)} min read</span>
        </span>
      </span>
    </a>
  );
}

export function ArticleEditor({ value, isPublished, onClose, onSave }) {
  const [form, setForm] = useState({
    title: "",
    category: "story",
    author: "",
    summary: "",
    body: "",
    cover: "",
    ...value,
  });
  const [tab, setTab] = useState("write");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef(null);
  const dirty = useRef(false);
  const set = (k, v) => {
    dirty.current = true;
    setForm((f) => ({ ...f, [k]: v }));
  };

  const coverIsUpload = String(form.cover || "").startsWith("data:image/");
  const coverLinkProblem = coverIsUpload ? "" : describePhotoLink(form.cover);

  function close() {
    if (dirty.current && !window.confirm("Close without saving your changes?")) return;
    onClose();
  }

  async function pickCover(file) {
    setError("");
    setBusy("cover");
    try {
      set("cover", await prepareCover(file));
    } catch (err) {
      setError(err.message || "Could not use this image.");
    } finally {
      setBusy("");
    }
  }

  async function submit(publish) {
    setError("");
    setBusy(publish ? "publish" : "draft");
    try {
      await onSave(form, publish);
    } catch (err) {
      setError(err.message || "Could not save the article.");
      setBusy("");
    }
  }

  return (
    <div className="modal-back" onClick={close}>
      <form
        className="modal glass wide article-editor"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          submit(true);
        }}
      >
        <p className="kicker">Carelnak · Admin</p>
        <h2>{value.id ? "Edit article" : "New article"}</h2>

        <label>
          Title
          <input value={form.title} onChange={(e) => set("title", e.target.value)} required />
        </label>
        <div className="grid-2">
          <label>
            Category
            <select value={form.category} onChange={(e) => set("category", e.target.value)}>
              {ARTICLE_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Author
            <input value={form.author} onChange={(e) => set("author", e.target.value)} placeholder="Who wrote it" />
          </label>
        </div>

        <div className="article-cover-field">
          <Cover src={form.cover} alt="" className="small" />
          <div className="photo-field-body">
            <span className="photo-field-label">Cover image (optional)</span>
            <div className="photo-field-actions">
              <button
                type="button"
                className="btn ghost"
                disabled={busy === "cover"}
                onClick={() => fileRef.current?.click()}
              >
                {busy === "cover" ? "Preparing…" : form.cover ? "Change image" : "Upload image"}
              </button>
              {form.cover && (
                <button type="button" className="btn ghost" onClick={() => set("cover", "")}>
                  Remove
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) pickCover(file);
                }}
              />
            </div>
            {!coverIsUpload && (
              <label className="photo-link">
                Or paste an image link
                <input
                  type="url"
                  value={form.cover}
                  onChange={(e) => set("cover", e.target.value)}
                  placeholder="https://…"
                />
              </label>
            )}
            {coverLinkProblem && <span className="field-error">{coverLinkProblem}</span>}
          </div>
        </div>

        <label>
          Short summary (shown on the card)
          <textarea rows={2} value={form.summary} onChange={(e) => set("summary", e.target.value)} />
        </label>

        <div className="editor-tabs" role="tablist">
          <button type="button" className={`media-tab ${tab === "write" ? "active" : ""}`} onClick={() => setTab("write")}>
            Write
          </button>
          <button type="button" className={`media-tab ${tab === "preview" ? "active" : ""}`} onClick={() => setTab("preview")}>
            Preview
          </button>
        </div>
        {tab === "write" ? (
          <label>
            Article
            <textarea
              className="article-textarea"
              rows={14}
              value={form.body}
              onChange={(e) => set("body", e.target.value)}
              placeholder={"Write the story here.\n\nLeave an empty line between paragraphs.\n# Heading\n> A quote from an elder\n- A list item\n**bold**  *italic*"}
            />
            <span className="field-hint">
              Empty line = new paragraph · # heading · &gt; quote · - list · **bold** · *italic*
            </span>
          </label>
        ) : (
          <div className="article-preview">
            {form.body ? <ArticleBody body={form.body} /> : <p className="muted">Nothing written yet.</p>}
          </div>
        )}

        {error && <p className="error">{error}</p>}
        <div className="row wrap-row">
          <button className="btn gold" type="submit" disabled={Boolean(busy)}>
            {busy === "publish" ? "Publishing…" : isPublished ? "Update published article" : "Publish"}
          </button>
          <button className="btn ghost" type="button" disabled={Boolean(busy)} onClick={() => submit(false)}>
            {busy === "draft" ? "Saving…" : isPublished ? "Unpublish & keep as draft" : "Save draft"}
          </button>
          <button className="btn ghost" type="button" onClick={close}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
