import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onValue, ref, remove, set } from "firebase/database";
import { db, isFirebaseConfigured } from "./firebase";
import { useAuth } from "./AuthContext";

const PUBLISHED = "sungkharArticles";
const DRAFTS = "sungkharArticleDrafts";

export const ARTICLE_CATEGORIES = [
  { id: "story", label: "Family story" },
  { id: "news", label: "News" },
  { id: "history", label: "Historical record" },
];

const ArticlesContext = createContext(null);

function toList(value) {
  if (!value) return [];
  return (Array.isArray(value) ? value : Object.values(value)).filter((a) => a && a.id);
}

function newArticleId() {
  return `art_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function clean(article) {
  return {
    id: article.id,
    title: String(article.title || "").trim(),
    category: ARTICLE_CATEGORIES.some((c) => c.id === article.category) ? article.category : "story",
    author: String(article.author || "").trim(),
    summary: String(article.summary || "").trim(),
    body: String(article.body || "").replace(/\r/g, "").trim(),
    cover: String(article.cover || ""),
    createdAt: Number(article.createdAt) || Date.now(),
    createdBy: String(article.createdBy || ""),
    publishedAt: Number(article.publishedAt) || 0,
  };
}

function byNewest(a, b) {
  return (b.publishedAt || b.updatedAt || 0) - (a.publishedAt || a.updatedAt || 0);
}

export function ArticlesProvider({ children }) {
  const { isAdmin, user } = useAuth();
  const [published, setPublished] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [loaded, setLoaded] = useState(!isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) return undefined;
    return onValue(
      ref(db, PUBLISHED),
      (snap) => {
        setPublished(toList(snap.val()).sort(byNewest));
        setLoaded(true);
      },
      () => setLoaded(true)
    );
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured || !isAdmin) {
      setDrafts([]);
      return undefined;
    }
    return onValue(
      ref(db, DRAFTS),
      (snap) => setDrafts(toList(snap.val()).sort(byNewest)),
      () => setDrafts([])
    );
  }, [isAdmin]);

  const value = useMemo(
    () => ({
      published,
      drafts,
      loaded,
      isAdmin,
      async saveArticle(draft, { publish }) {
        if (!isAdmin) throw new Error("Only an Admin can publish articles.");
        if (!isFirebaseConfigured) throw new Error("Firebase is not configured.");
        const record = clean({ ...draft, id: draft.id || newArticleId() });
        if (!record.title) throw new Error("Give the article a title.");
        if (publish && !record.body) throw new Error("Write the article before publishing it.");
        const now = Date.now();
        const saved = {
          ...record,
          createdBy: record.createdBy || user?.email || "",
          updatedAt: now,
          updatedBy: user?.email || "",
          publishedAt: publish ? record.publishedAt || now : 0,
        };
        if (publish) {
          await set(ref(db, `${PUBLISHED}/${saved.id}`), saved);
          await remove(ref(db, `${DRAFTS}/${saved.id}`));
        } else {
          await set(ref(db, `${DRAFTS}/${saved.id}`), saved);
          await remove(ref(db, `${PUBLISHED}/${saved.id}`));
        }
        return saved;
      },
      async deleteArticle(article) {
        if (!isAdmin) throw new Error("Only an Admin can delete articles.");
        if (!article?.id) return;
        await remove(ref(db, `${PUBLISHED}/${article.id}`));
        await remove(ref(db, `${DRAFTS}/${article.id}`));
      },
    }),
    [published, drafts, loaded, isAdmin, user]
  );

  return <ArticlesContext.Provider value={value}>{children}</ArticlesContext.Provider>;
}

export function useArticles() {
  const ctx = useContext(ArticlesContext);
  if (!ctx) throw new Error("useArticles must be used within ArticlesProvider");
  return ctx;
}
