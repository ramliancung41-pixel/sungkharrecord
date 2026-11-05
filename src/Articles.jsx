import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ARTICLE_CATEGORIES, useArticles } from "./ArticlesContext";
import { IconBtn, IconPencil, IconTrash } from "./uiIcons";
import { normalizePhotoUrl, prepareCover, describePhotoLink } from "./memberPhotos";

const HASH = /^#carelnak\/([\w-]+)$/;

function categoryLabel(id) {
  return ARTICLE_CATEGORIES.find((c) => c.id === id)?.label || "Family story";
}

function formatDay(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function readingMinutes(body) {
  const words = String(body || "").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function excerpt(article, length = 180) {
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

function ArticleBody({ body }) {
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

function Cover({ src, alt, className = "" }) {
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

function ArticleCard({ article, featured = false, draft = false, onOpen }) {
  return (
    <button
      type="button"
      className={`article-card ${featured ? "featured" : ""} ${draft ? "draft" : ""}`}
      onClick={() => onOpen(article)}
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
    </button>
  );
}

export default function ArticlesSection() {
  const { published, drafts, loaded, isAdmin, saveArticle, deleteArticle } = useArticles();
  const [category, setCategory] = useState("all");
  const [openId, setOpenId] = useState(() => window.location.hash.match(HASH)?.[1] || "");
  const [editing, setEditing] = useState(null);
  const openedHere = useRef(false);

  useEffect(() => {
    function onHash() {
      setOpenId(window.location.hash.match(HASH)?.[1] || "");
    }
    window.addEventListener("hashchange", onHash);
    window.addEventListener("popstate", onHash);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("popstate", onHash);
    };
  }, []);

  const visible = useMemo(
    () => (category === "all" ? published : published.filter((a) => a.category === category)),
    [published, category]
  );
  const all = useMemo(() => [...published, ...(isAdmin ? drafts : [])], [published, drafts, isAdmin]);
  const open = openId ? all.find((a) => a.id === openId) : null;

  function openArticle(article) {
    openedHere.current = true;
    window.history.pushState(null, "", `#carelnak/${article.id}`);
    setOpenId(article.id);
  }

  function closeArticle() {
    if (openedHere.current) {
      openedHere.current = false;
      window.history.back();
    } else {
      window.history.replaceState(null, "", "#carelnak");
    }
    setOpenId("");
  }

  const [featured, ...rest] = visible;

  return (
    <section className="panel articles" id="carelnak">
      <div className="panel-head wrap">
        <div>
          <p className="kicker">Carelnak · Articles</p>
          <h2>Family stories &amp; records</h2>
        </div>
        {isAdmin && (
          <button className="btn gold" type="button" onClick={() => setEditing({ category: "story" })}>
            New article
          </button>
        )}
      </div>
      <p className="hint">
        Stories, news, and historical records of the Sungkhar house.{" "}
        {isAdmin ? "As Admin you can write, edit, and publish articles." : "Only Admins can publish articles."}
      </p>

      <div className="article-filters" role="tablist" aria-label="Article categories">
        {[{ id: "all", label: "All" }, ...ARTICLE_CATEGORIES].map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={category === c.id}
            className={`media-tab ${category === c.id ? "active" : ""}`}
            onClick={() => setCategory(c.id)}
          >
            {c.label}
            <em>{c.id === "all" ? published.length : published.filter((a) => a.category === c.id).length}</em>
          </button>
        ))}
      </div>

      {isAdmin && drafts.length > 0 && (
        <div className="article-drafts">
          <p className="kicker">Drafts · only Admins can see these</p>
          <div className="article-grid">
            {drafts.map((a) => (
              <ArticleCard key={a.id} article={a} draft onOpen={openArticle} />
            ))}
          </div>
        </div>
      )}

      {!loaded ? (
        <div className="article-empty glass">Loading articles…</div>
      ) : !visible.length ? (
        <div className="article-empty glass">
          {published.length
            ? "No articles in this category yet."
            : isAdmin
              ? "No articles yet. Press “New article” to write the first family story."
              : "No articles have been published yet."}
        </div>
      ) : (
        <>
          <ArticleCard article={featured} featured onOpen={openArticle} />
          {rest.length > 0 && (
            <div className="article-grid">
              {rest.map((a) => (
                <ArticleCard key={a.id} article={a} onOpen={openArticle} />
              ))}
            </div>
          )}
        </>
      )}

      {open &&
        createPortal(
          <ArticleReader
            article={open}
            list={visible.some((a) => a.id === open.id) ? visible : all}
            isAdmin={isAdmin}
            isDraft={!published.some((a) => a.id === open.id)}
            onClose={closeArticle}
            onOpen={(a) => {
              window.history.replaceState(null, "", `#carelnak/${a.id}`);
              setOpenId(a.id);
            }}
            onEdit={() => setEditing(open)}
            onDelete={async () => {
              if (!window.confirm(`Delete “${open.title}”? This cannot be undone.`)) return;
              try {
                await deleteArticle(open);
                closeArticle();
              } catch (err) {
                window.alert(err.message || "Could not delete the article.");
              }
            }}
          />,
          document.body
        )}

      {editing &&
        isAdmin &&
        createPortal(
          <ArticleEditor
            value={editing}
            isPublished={published.some((a) => a.id === editing.id)}
            onClose={() => setEditing(null)}
            onSave={async (draft, publish) => {
              const saved = await saveArticle(draft, { publish });
              setEditing(null);
              if (publish) openArticle(saved);
            }}
          />,
          document.body
        )}
    </section>
  );
}

function ArticleReader({ article, list, isAdmin, isDraft, onClose, onOpen, onEdit, onDelete }) {
  const pageRef = useRef(null);

  useEffect(() => {
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  useEffect(() => {
    if (pageRef.current) pageRef.current.scrollTop = 0;
  }, [article.id]);

  const index = list.findIndex((a) => a.id === article.id);
  const newer = index > 0 ? list[index - 1] : null;
  const older = index >= 0 && index < list.length - 1 ? list[index + 1] : null;

  return (
    <div className="article-reader-back" role="dialog" aria-modal="true" aria-label={article.title}>
      <div className="article-reader" ref={pageRef}>
        <div className="article-reader-bar">
          <button type="button" className="book-sheet-close" onClick={onClose}>
            ‹ Carelnak
          </button>
          {isAdmin && (
            <div className="article-reader-admin">
              {isDraft && <b className="draft-pill">Draft</b>}
              <IconBtn label="Edit article" onClick={onEdit}>
                <IconPencil />
              </IconBtn>
              <IconBtn label="Delete article" danger onClick={onDelete}>
                <IconTrash />
              </IconBtn>
            </div>
          )}
        </div>

        <article className="article-page">
          <Cover src={article.cover} alt={article.title} className="hero" />
          <p className="article-meta-line">
            <em>{categoryLabel(article.category)}</em>
            <span>{isDraft ? "Not published" : formatDay(article.publishedAt)}</span>
            <span>{readingMinutes(article.body)} min read</span>
          </p>
          <h1 className="article-title">{article.title}</h1>
          {article.author && <p className="article-byline">By {article.author}</p>}
          {article.summary && <p className="article-summary">{article.summary}</p>}
          <ArticleBody body={article.body} />
        </article>

        {(newer || older) && (
          <nav className="article-pager" aria-label="More articles">
            {older ? (
              <button type="button" onClick={() => onOpen(older)}>
                <small>‹ Older</small>
                <span>{older.title}</span>
              </button>
            ) : (
              <span />
            )}
            {newer ? (
              <button type="button" className="next" onClick={() => onOpen(newer)}>
                <small>Newer ›</small>
                <span>{newer.title}</span>
              </button>
            ) : (
              <span />
            )}
          </nav>
        )}
      </div>
    </div>
  );
}

function ArticleEditor({ value, isPublished, onClose, onSave }) {
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
