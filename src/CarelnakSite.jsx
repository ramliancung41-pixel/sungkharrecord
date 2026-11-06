import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "./AuthContext";
import { ARTICLE_CATEGORIES, useArticles } from "./ArticlesContext";
import {
  ArticleBody,
  ArticleCard,
  ArticleEditor,
  Cover,
  categoryLabel,
  formatDay,
  readingMinutes,
} from "./Articles";
import LoginModal from "./LoginModal";
import { IconBtn, IconPencil, IconTrash } from "./uiIcons";

const SITE_TITLE = "Carelnak · Sungkhar Tuanthu";

function idFromPath() {
  return window.location.pathname.match(/^\/carelnak\/([\w-]+)/)?.[1] || "";
}

export default function CarelnakSite() {
  const { isAdmin, login, loginWithGoogle, logout, configured, user } = useAuth();
  const { published, drafts, loaded, saveArticle, deleteArticle } = useArticles();
  const [articleId, setArticleId] = useState(idFromPath);
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    const onPop = () => setArticleId(idFromPath());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const all = useMemo(() => [...published, ...(isAdmin ? drafts : [])], [published, drafts, isAdmin]);
  const article = articleId ? all.find((a) => a.id === articleId) : null;
  const isDraft = Boolean(article && !published.some((a) => a.id === article.id));

  useEffect(() => {
    document.title = article ? `${article.title} · Carelnak` : SITE_TITLE;
  }, [article]);

  function go(id) {
    window.history.pushState(null, "", id ? `/carelnak/${id}` : "/carelnak");
    setArticleId(id);
    window.scrollTo({ top: 0 });
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return published.filter(
      (a) =>
        (category === "all" || a.category === category) &&
        (!q || [a.title, a.summary, a.author, a.body].join(" ").toLowerCase().includes(q))
    );
  }, [published, category, query]);

  return (
    <div className="cn-site">
      <header className="cn-header">
        <div className="cn-header-inner">
          <a
            className="cn-brand"
            href="/carelnak"
            onClick={(e) => {
              e.preventDefault();
              go("");
            }}
          >
            <span className="seal">ST</span>
            <span>
              <strong>Carelnak</strong>
              <em>Sungkhar Tuanthu</em>
            </span>
          </a>
          <nav className="cn-header-nav">
            <a href="/" className="cn-link">
              Family tree
            </a>
            {isAdmin ? (
              <>
                <button className="btn gold" type="button" onClick={() => setEditing({ category: "story" })}>
                  New article
                </button>
                <button className="btn ghost" type="button" onClick={logout} title={user?.email || ""}>
                  Sign out
                </button>
              </>
            ) : (
              <button className="btn ghost" type="button" onClick={() => setLoginOpen(true)}>
                Admin
              </button>
            )}
          </nav>
        </div>
      </header>

      <main className="cn-main">
        {articleId ? (
          !loaded ? (
            <p className="cn-state">Loading article…</p>
          ) : article ? (
            <ArticlePage
              article={article}
              isDraft={isDraft}
              isAdmin={isAdmin}
              list={published}
              onBack={() => go("")}
              onOpen={(a) => go(a.id)}
              onEdit={() => setEditing(article)}
              onDelete={async () => {
                if (!window.confirm(`Delete “${article.title}”? This cannot be undone.`)) return;
                try {
                  await deleteArticle(article);
                  go("");
                } catch (err) {
                  window.alert(err.message || "Could not delete the article.");
                }
              }}
            />
          ) : (
            <div className="cn-state">
              <h1>Article not found</h1>
              <p>It may have been removed or not published yet.</p>
              <button className="btn gold" type="button" onClick={() => go("")}>
                Back to all articles
              </button>
            </div>
          )
        ) : (
          <Home
            loaded={loaded}
            published={published}
            filtered={filtered}
            drafts={isAdmin ? drafts : []}
            category={category}
            onCategory={setCategory}
            query={query}
            onQuery={setQuery}
            isAdmin={isAdmin}
            onOpen={(a) => go(a.id)}
          />
        )}
      </main>

      <footer className="cn-footer">
        <span className="seal">ST</span>
        <p>Carelnak · stories, news and records of the Sungkhar house</p>
        <a href="/" className="cn-link">
          Open the family tree ↗
        </a>
      </footer>

      {loginOpen && !isAdmin && (
        <LoginModal
          onClose={() => setLoginOpen(false)}
          onLogin={login}
          onGoogle={loginWithGoogle}
          configured={configured}
        />
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
              go(saved.id);
            }}
          />,
          document.body
        )}
    </div>
  );
}

function Home({ loaded, published, filtered, drafts, category, onCategory, query, onQuery, isAdmin, onOpen }) {
  const searching = Boolean(query.trim()) || category !== "all";
  const [featured, ...rest] = searching ? [null, ...filtered] : filtered;

  return (
    <>
      <section className="cn-hero">
        <p className="kicker">Sungkhar Tuanthu</p>
        <h1>Carelnak</h1>
        <p>Family stories, news, and historical records of the Sungkhar house.</p>
      </section>

      <div className="cn-toolbar">
        <div className="cn-tabs" role="tablist" aria-label="Categories">
          {[{ id: "all", label: "All" }, ...ARTICLE_CATEGORIES].map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={category === c.id}
              className={category === c.id ? "active" : ""}
              onClick={() => onCategory(c.id)}
            >
              {c.label}
              <span>{c.id === "all" ? published.length : published.filter((a) => a.category === c.id).length}</span>
            </button>
          ))}
        </div>
        <input
          className="cn-search"
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search articles"
          aria-label="Search articles"
        />
      </div>

      {drafts.length > 0 && (
        <section className="cn-drafts">
          <h2>Drafts · only Admins can see these</h2>
          <div className="article-grid">
            {drafts.map((a) => (
              <ArticleCard key={a.id} article={a} draft onOpen={onOpen} />
            ))}
          </div>
        </section>
      )}

      {!loaded ? (
        <p className="cn-state">Loading articles…</p>
      ) : !filtered.length ? (
        <div className="cn-state">
          {published.length
            ? "No articles match this search."
            : isAdmin
              ? "No articles yet. Press “New article” to write the first family story."
              : "No articles have been published yet. Please check back soon."}
        </div>
      ) : (
        <>
          {featured && <ArticleCard article={featured} featured onOpen={onOpen} />}
          {rest.length > 0 && (
            <section>
              {!searching && <h2 className="cn-section-title">More articles</h2>}
              <div className="article-grid">
                {rest.map((a) => (
                  <ArticleCard key={a.id} article={a} onOpen={onOpen} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}

function ArticlePage({ article, isDraft, isAdmin, list, onBack, onOpen, onEdit, onDelete }) {
  const index = list.findIndex((a) => a.id === article.id);
  const newer = index > 0 ? list[index - 1] : null;
  const older = index >= 0 && index < list.length - 1 ? list[index + 1] : null;
  const related = list.filter((a) => a.id !== article.id && a.category === article.category).slice(0, 3);

  return (
    <>
      <div className="cn-article-bar">
        <a
          href="/carelnak"
          className="cn-link"
          onClick={(e) => {
            e.preventDefault();
            onBack();
          }}
        >
          ‹ All articles
        </a>
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

      <article className="article-page cn-article">
        <p className="article-meta-line">
          <em>{categoryLabel(article.category)}</em>
          <span>{isDraft ? "Not published" : formatDay(article.publishedAt)}</span>
          <span>{readingMinutes(article.body)} min read</span>
        </p>
        <h1 className="article-title">{article.title}</h1>
        {article.author && <p className="article-byline">By {article.author}</p>}
        <Cover src={article.cover} alt={article.title} className="hero" />
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

      {related.length > 0 && (
        <section className="cn-related">
          <h2 className="cn-section-title">More in {categoryLabel(article.category)}</h2>
          <div className="article-grid">
            {related.map((a) => (
              <ArticleCard key={a.id} article={a} onOpen={onOpen} />
            ))}
          </div>
        </section>
      )}

      <p className="cn-share">
        Share this article:{" "}
        <a href={`/carelnak/${article.id}`}>{`${window.location.origin}/carelnak/${article.id}`}</a>
      </p>
    </>
  );
}
