import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { useData } from "./DataContext";
import MediaDrawer from "./AdminMediaPanel";
import MediaGallery from "./MediaGallery";
import TreeSearchBar from "./TreeSearchBar";
import FamilyBook from "./FamilyBook";
import { IconBtn, IconPencil, IconTrash } from "./uiIcons";
import {
  describePhotoLink,
  normalizePhotoUrl,
  preparePortrait,
  useMemberPhoto,
} from "./memberPhotos";
import {
  compareLineageCodes,
  computeDisplayDots,
  computeLineageCodes,
  defaultRootMother,
  displayMemberName,
  emptyRootSlot,
  findPrimaryRoot,
  familyDot,
  findRootSpouse,
  formatLineageLabel,
  generationFromLineage,
  indexByParent,
  memberMatchesQuery,
  nextBirthOrder,
  previewLineageCode,
  rankSearchHit,
} from "./lineage";

function newId(prefix) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const RELATION_CHOICES = [
  "First Son",
  "Second Son",
  "Third Son",
  "Fourth Son",
  "Fifth Son",
  "Sixth Son",
  "First Daughter",
  "Second Daughter",
  "Third Daughter",
  "Fourth Daughter",
  "Fifth Daughter",
  "Father · Root",
  "Mother · Root",
  "Spouse",
];

function normalizeGender(gender) {
  const g = String(gender || "").toLowerCase();
  if (g === "nu") return "female";
  if (g === "pa") return "male";
  if (g === "female" || g === "male" || g === "other") return g;
  return "male";
}

function HeroInlineField({
  as = "h1",
  className = "",
  value,
  multiline = false,
  canEdit,
  placeholder,
  onSave,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  async function commit() {
    const next = draft.trim();
    if (!next || next === value) {
      setDraft(value);
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(next);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  if (!canEdit) {
    const Tag = as;
    return <Tag className={className}>{value}</Tag>;
  }

  if (!editing) {
    const Tag = as;
    return (
      <Tag
        className={`${className} hero-editable`}
        onClick={() => setEditing(true)}
        title="Click to edit"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setEditing(true);
          }
        }}
      >
        {value}
        <span className="hero-edit-hint">Edit</span>
      </Tag>
    );
  }

  return (
    <div className={`hero-edit-wrap ${multiline ? "multi" : "single"}`}>
      {multiline ? (
        <textarea
          className={`hero-edit-input ${className}`}
          value={draft}
          rows={3}
          autoFocus
          placeholder={placeholder}
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") cancel();
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
        />
      ) : (
        <input
          className={`hero-edit-input ${className}`}
          value={draft}
          autoFocus
          placeholder={placeholder}
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") cancel();
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
        />
      )}
      <div className="hero-edit-actions">
        <button className="btn gold" type="button" disabled={saving} onClick={commit}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button className="btn ghost" type="button" disabled={saving} onClick={cancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const { isAdmin, login, loginWithGoogle, logout, user, configured } = useAuth();
  const {
    data,
    live,
    status,
    saveChronicle,
    saveTimeline,
    upsertMember,
    deleteMember,
    addDot,
    deleteDot,
  } = useData();
  const [loginOpen, setLoginOpen] = useState(false);
  const [memberForm, setMemberForm] = useState(null);
  const [eventForm, setEventForm] = useState(null);
  const [editingOrigin, setEditingOrigin] = useState(false);
  const [originDraft, setOriginDraft] = useState(data.chronicle);
  const [selectedId, setSelectedId] = useState("");
  const [mediaOpen, setMediaOpen] = useState(false);
  const [queryInput, setQueryInput] = useState("");
  const [genFilter, setGenFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [openGens, setOpenGens] = useState(() => new Set([1, 2]));
  const [highlightId, setHighlightId] = useState("");
  const [revealKey, setRevealKey] = useState(0);

  useEffect(() => {
    setOriginDraft(data.chronicle);
  }, [data.chronicle]);

  const members = data.members || [];
  const byId = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members]);
  const lineage = useMemo(() => computeLineageCodes(members), [members]);
  const childrenByParent = useMemo(() => indexByParent(members), [members]);
  const displayDots = useMemo(() => computeDisplayDots(members), [members]);

  const filtering = Boolean(queryInput.trim() || genFilter || branchFilter);

  const matchedIds = useMemo(() => {
    const ids = new Set();
    for (const m of members) {
      const code = lineage[m.id] || m.lineage || "";
      const inDot = { ...m, generation: displayDots[m.id] };
      if (memberMatchesQuery(inDot, code, queryInput, genFilter, branchFilter)) ids.add(m.id);
    }
    return ids;
  }, [members, lineage, displayDots, queryInput, genFilter, branchFilter]);

  const searchHits = useMemo(() => {
    const q = String(queryInput || "").trim();
    if (!q) return [];
    return members
      .filter((m) => !m.emptySlot && !m.virtual)
      .map((m) => {
        const code = lineage[m.id] || m.lineage || "";
        return { ...m, code, lineage: code, generation: displayDots[m.id] };
      })
      .filter((m) => memberMatchesQuery(m, m.code, queryInput, genFilter, branchFilter))
      .sort((a, b) => {
        const rank = rankSearchHit(a, a.code, queryInput) - rankSearchHit(b, b.code, queryInput);
        if (rank !== 0) return rank;
        return compareLineageCodes(a.code, b.code);
      })
      .slice(0, 12);
  }, [members, lineage, displayDots, queryInput, genFilter, branchFilter]);

  const allGenerations = useMemo(() => {
    const set = new Set(Object.values(displayDots));
    for (const d of Array.isArray(data.dots) ? data.dots : []) {
      const n = Number(d);
      if (n > 0) set.add(n);
    }
    return [...set].sort((a, b) => a - b);
  }, [data.dots, displayDots]);

  const branchOptions = useMemo(() => {
    const set = new Set();
    for (const m of members) {
      const b = String(m.branch || m.relation || "").trim();
      if (b) set.add(b);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [members]);

  const generations = useMemo(() => {
    const map = new Map();
    const declared = Array.isArray(data.dots) ? data.dots : [];
    for (const d of declared) {
      const g = Number(d);
      if (Number.isFinite(g) && g > 0) map.set(g, []);
    }
    for (const m of members) {
      const g = displayDots[m.id] || 2;
      if (filtering && !matchedIds.has(m.id)) continue;
      if (!map.has(g)) map.set(g, []);
      map.get(g).push(m);
    }
    if (map.size === 0) map.set(1, []);
    for (const [g, people] of map) {
      people.sort((a, b) => {
        const cmp = compareLineageCodes(lineage[a.id], lineage[b.id]);
        if (cmp !== 0) return cmp;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
      map.set(g, people);
    }
    return [...map.entries()]
      .filter(([, people]) => !filtering || people.length > 0)
      .sort((a, b) => a[0] - b[0]);
  }, [members, data.dots, lineage, displayDots, filtering, matchedIds]);

  function childrenOf(id) {
    return childrenByParent.get(id) || [];
  }

  function toggleGen(gen) {
    setOpenGens((prev) => {
      const next = new Set(prev);
      if (next.has(gen)) next.delete(gen);
      else next.add(gen);
      return next;
    });
  }

  const jumpToMember = useCallback(
    (member) => {
      if (!member?.id) return;
      const gen = displayDots[member.id] || 2;
      setOpenGens((prev) => {
        const next = new Set(prev);
        next.add(gen);
        return next;
      });
      setSelectedId(member.id);
      setHighlightId(member.id);
      setRevealKey((k) => k + 1);
      if (!window.matchMedia("(max-width: 900px)").matches) {
        window.requestAnimationFrame(() => {
          document.getElementById("tree")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    },
    [displayDots]
  );

  useEffect(() => {
    if (!highlightId) return undefined;
    const t = window.setTimeout(() => setHighlightId(""), 3200);
    return () => window.clearTimeout(t);
  }, [highlightId]);

  const rootCoupleCards = useCallback(
    (people) => {
      const root = findPrimaryRoot(members);
      const spouseMember = findRootSpouse(members, root) || (root ? defaultRootMother(root) : null);
      return [
        {
          member: root
            ? people.find((p) => p.id === root.id) || root
            : emptyRootSlot("pa", spouseMember?.name || ""),
          role: "pa",
          empty: !root,
        },
        {
          member: spouseMember
            ? people.find((p) => p.id === spouseMember.id) || spouseMember
            : emptyRootSlot("nu", root?.name || ""),
          role: "nu",
          empty: !spouseMember,
        },
      ];
    },
    [members]
  );

  const activeId =
    selectedId && byId[selectedId] ? selectedId : findPrimaryRoot(members)?.id || members[0]?.id || "";

  async function removeMember(member) {
    if (childrenOf(member.id).length) {
      window.alert(
        `${displayMemberName(member)} still has children. Move or remove the children first so they stay in the right family.`
      );
      return;
    }
    if (!window.confirm(`Remove ${displayMemberName(member) || "this member"} from the chronicle?`)) return;
    try {
      await deleteMember(member.id);
      if (member.id === selectedId) setSelectedId(member.parentId || "");
    } catch (err) {
      window.alert(err.message || "Could not remove this member.");
    }
  }

  function addMemberToDot(gen) {
    openNewMember(gen, "", gen);
  }

  async function removeDot(gen) {
    if (!window.confirm(`Delete empty Dot ${gen}?`)) return;
    try {
      await deleteDot(gen);
    } catch (err) {
      window.alert(err.message || "Could not delete Dot.");
    }
  }

  function openFoundingSlot(role) {
    const root = findPrimaryRoot(members);
    const spouseMember = findRootSpouse(members, root);
    const isFather = role === "pa";
    setMemberForm({
      id: newId("m"),
      name: "",
      generation: 1,
      parentId: "",
      spouse: isFather ? spouseMember?.name || "" : root?.name || root?.spouse || "",
      spouseDob: "",
      dob: "",
      dod: "",
      gender: isFather ? "male" : "female",
      relation: isFather ? "Father · Root" : "Mother · Root",
      branch: isFather ? "Father · Root" : "Mother · Root",
      bio: "",
      isNew: true,
      isFounding: true,
    });
  }

  function openNewMember(generation = 1, parentId = "", targetDot = 0) {
    const parent = byId[parentId];
    const parentCode = parent ? lineage[parent.id] : "";
    setMemberForm({
      id: newId("m"),
      name: "",
      generation: parent ? (Number(parent.generation) || 1) + 1 : generation,
      parentId,
      birthOrder: nextBirthOrder(members, parentId),
      dot: familyDot(members, parentId) || targetDot || "",
      spouse: "",
      spouseDob: "",
      dob: "",
      dod: "",
      gender: "male",
      relation: "",
      branch: parentCode ? `AD · ${parentCode}` : "Dot 1 · Root",
      bio: "",
      isNew: true,
      targetDot,
    });
  }

  async function handleAddDot() {
    const nextNum = await addDot();
    requestAnimationFrame(() => {
      document.getElementById(`dot-${nextNum}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }

  return (
    <div className="app">
      <div className="orb orb-a" />
      <div className="orb orb-b" />
      <div className="orb orb-c" />

      <header className="nav glass">
        <a className="brand" href="#origin">
          <span className="seal">ST</span>
          <span>
            <strong>Sungkhar Tuanthu</strong>
            <em>Family chronicle</em>
          </span>
        </a>
        <nav>
          <a href="#origin">Origin</a>
          <a href="#timeline">Timeline</a>
          <a href="#tree">Family tree</a>
          <a href="#media">Media</a>
        </nav>
        <div className="nav-end">
          <span className={`pulse ${live ? "on" : ""}`} title={status} />
          <button className="btn gold" type="button" onClick={() => setMediaOpen(true)}>
            Media
          </button>
          {isAdmin ? (
            <button className="btn ghost" type="button" onClick={logout}>
              Sign out
            </button>
          ) : (
            <button className="btn ghost" type="button" onClick={() => setLoginOpen(true)}>
              Admin
            </button>
          )}
        </div>
      </header>

      <TreeSearchBar
        query={queryInput}
        onQuery={setQueryInput}
        generation={genFilter}
        onGeneration={setGenFilter}
        branch={branchFilter}
        onBranch={setBranchFilter}
        generations={allGenerations}
        branches={branchOptions}
        matchCount={filtering ? matchedIds.size : members.length}
        totalCount={members.length}
        results={searchHits}
        onPick={jumpToMember}
      />

      <section className="hero" id="origin">
        <p className="kicker">{data.chronicle.kicker}</p>
        <HeroInlineField
          as="h1"
          value={data.chronicle.title}
          canEdit={isAdmin}
          placeholder="Main title"
          onSave={async (title) => {
            await saveChronicle({ ...data.chronicle, title });
          }}
        />
        <HeroInlineField
          as="p"
          className="lede"
          multiline
          value={data.chronicle.subtitle}
          canEdit={isAdmin}
          placeholder="Subtitle"
          onSave={async (subtitle) => {
            await saveChronicle({ ...data.chronicle, subtitle });
          }}
        />
        <div className="hero-meta">
          <span>{status}</span>
          {isAdmin && <span className="chip">Keeper signed in · {user?.email}</span>}
          {isAdmin && <span className="chip">Click title or subtitle to edit</span>}
          {!isAdmin && <span className="chip">Guest · read only</span>}
        </div>
      </section>

      <section className="panel glass origin-panel">
        <div className="panel-head">
          <h2>Origin of the house</h2>
          {isAdmin && !editingOrigin && (
            <button
              className="btn ghost"
              onClick={() => {
                setOriginDraft(data.chronicle);
                setEditingOrigin(true);
              }}
            >
              Edit
            </button>
          )}
        </div>
        {editingOrigin && isAdmin ? (
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              await saveChronicle(originDraft);
              setEditingOrigin(false);
            }}
          >
            <label>
              Kicker
              <input
                value={originDraft.kicker}
                onChange={(e) => setOriginDraft({ ...originDraft, kicker: e.target.value })}
              />
            </label>
            <label>
              Title
              <input
                value={originDraft.title}
                onChange={(e) => setOriginDraft({ ...originDraft, title: e.target.value })}
              />
            </label>
            <label>
              Subtitle
              <textarea
                rows={2}
                value={originDraft.subtitle}
                onChange={(e) => setOriginDraft({ ...originDraft, subtitle: e.target.value })}
              />
            </label>
            <label>
              Origin story
              <textarea
                rows={10}
                value={originDraft.origin}
                onChange={(e) => setOriginDraft({ ...originDraft, origin: e.target.value })}
              />
            </label>
            <div className="row">
              <button className="btn gold" type="submit">
                Save chronicle
              </button>
              <button className="btn ghost" type="button" onClick={() => setEditingOrigin(false)}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="origin-copy">
            {data.chronicle.origin.split("\n").map((para, i) =>
              para.trim() ? <p key={i}>{para}</p> : <br key={i} />
            )}
          </div>
        )}
      </section>

      <section className="panel" id="timeline">
        <div className="panel-head">
          <div>
            <p className="kicker">History</p>
            <h2>Timeline of the house</h2>
          </div>
          {isAdmin && (
            <button
              className="btn gold"
              onClick={() =>
                setEventForm({
                  id: newId("t"),
                  year: "",
                  title: "",
                  body: "",
                  isNew: true,
                })
              }
            >
              Add event
            </button>
          )}
        </div>
        <ol className="timeline">
          {(data.timeline || []).map((ev, i) => (
            <li key={ev.id} className="timeline-item glass" style={{ animationDelay: `${i * 80}ms` }}>
              <span className="year">{ev.year}</span>
              <h3>{ev.title}</h3>
              <p>{ev.body}</p>
              {isAdmin && (
                <div className="card-actions">
                  <IconBtn label="Edit" onClick={() => setEventForm({ ...ev })}>
                    <IconPencil />
                  </IconBtn>
                  <IconBtn
                    label="Delete"
                    danger
                    onClick={() => saveTimeline(data.timeline.filter((t) => t.id !== ev.id))}
                  >
                    <IconTrash />
                  </IconBtn>
                </div>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section className="panel" id="tree">
        <div className="panel-head wrap">
          <div>
            <p className="kicker">AD · Descendants / branches</p>
            <h2>Family tree</h2>
          </div>
          {isAdmin && (
            <div className="row">
              <button className="btn gold" type="button" onClick={handleAddDot}>
                Add Dot
              </button>
              <button className="btn ghost" type="button" onClick={() => openNewMember(1, "")}>
                Add Member
              </button>
            </div>
          )}
        </div>
        <p className="hint">
          Generation 1. holds only the founding couple: Pu Tai Lio (father / root) and Pi Tuak Tlem
          (mother / root). Their children begin in generation 2. as 1.1, 1.2, 1.3… Empty root slots
          stay blank until an Admin adds the ancestor.
        </p>
        <FamilyBook
          groups={generations}
          members={members}
          byId={byId}
          lineage={lineage}
          displayDots={displayDots}
          revealKey={revealKey}
          childrenOf={childrenOf}
          rootEntriesFor={rootCoupleCards}
          selectedId={activeId}
          onSelect={setSelectedId}
          highlightId={highlightId}
          openGens={openGens}
          onToggleGen={toggleGen}
          filtering={filtering}
          isAdmin={isAdmin}
          onEdit={(m) => setMemberForm({ ...m })}
          onAddChild={(m) => openNewMember(Number(m.generation) + 1, m.id)}
          onDelete={removeMember}
          onAddMember={addMemberToDot}
          onDeleteDot={removeDot}
          onFoundingSlot={openFoundingSlot}
        />
      </section>

      <section className="panel" id="media">
        <MediaGallery />
      </section>

      <footer className="foot">
        <div className="foot-seal" aria-hidden="true">
          ST
        </div>
        <p className="foot-title">Sungkhar Tuanthu · a living family record</p>
        <p className="foot-credit">Created &amp; Developed by Ram Lian Cung</p>
        <p className="foot-meta">
          {configured
            ? "Live with Firebase Realtime Database"
            : "Add Firebase keys in .env to sync this chronicle live"}
        </p>
      </footer>

      <MediaDrawer open={mediaOpen} onClose={() => setMediaOpen(false)} />

      {loginOpen && !isAdmin && (
        <LoginModal
          onClose={() => setLoginOpen(false)}
          onLogin={login}
          onGoogle={loginWithGoogle}
          configured={configured}
        />
      )}

      {memberForm && isAdmin && (
        <MemberModal
          members={members}
          lineage={lineage}
          displayDots={displayDots}
          dotList={allGenerations}
          value={memberForm}
          onClose={() => setMemberForm(null)}
          onSave={async (next, options) => {
            const { isNew, isFounding, targetDot, shownDot, ...rest } = next;
            try {
              await upsertMember(rest, options);
            } catch (err) {
              window.alert(err.message || "Could not save this member.");
              return;
            }
            setMemberForm(null);
            setSelectedId(rest.id);
            const dot = Number(shownDot) || 0;
            if (dot > 1) {
              setOpenGens((prev) => {
                const next = new Set(prev);
                next.add(dot);
                return next;
              });
            }
          }}
        />
      )}

      {eventForm && isAdmin && (
        <EventModal
          value={eventForm}
          onClose={() => setEventForm(null)}
          onSave={async (next) => {
            const { isNew, ...rest } = next;
            const list = [...(data.timeline || [])];
            const idx = list.findIndex((t) => t.id === rest.id);
            if (idx >= 0) list[idx] = rest;
            else list.push(rest);
            await saveTimeline(list);
            setEventForm(null);
          }}
        />
      )}
    </div>
  );
}

function LoginModal({ onClose, onLogin, onGoogle, configured }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function run(action) {
    setBusy(true);
    setErr("");
    try {
      await action();
      onClose();
    } catch (ex) {
      setErr(ex.message || "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <form
        className="modal glass"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          run(() => onLogin(email, password));
        }}
      >
        <p className="kicker">Restricted</p>
        <h2>Admin keeper</h2>
        <p className="muted">
          Sign in with an authorized Gmail. Only those keepers can add, edit, or delete. Everyone
          else stays read-only.
        </p>
        <button
          className="btn google"
          type="button"
          disabled={busy}
          onClick={() => run(onGoogle)}
        >
          <GoogleMark />
          {busy ? "Opening Google…" : "Sign in with Google"}
        </button>
        <div className="or-line" role="separator">
          <span>or email</span>
        </div>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {err && <p className="error">{err}</p>}
        {!configured && (
          <p className="hint">
            Firebase is not configured. Local keeper: <code>admin@sungkhar.local</code> /{" "}
            <code>SungkharAdmin</code>
          </p>
        )}
        <div className="row">
          <button className="btn gold" disabled={busy} type="submit">
            {busy ? "Signing in…" : "Enter"}
          </button>
          <button className="btn ghost" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5c-.3 1.5-1.1 2.7-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.5 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1C3.4 21.3 7.4 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.4 14.4c-.2-.7-.4-1.4-.4-2.4s.1-1.7.4-2.4V6.5H1.4C.5 8.3 0 10.1 0 12s.5 3.7 1.4 5.5l4-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.8c1.7 0 3.3.6 4.5 1.7l3.4-3.4C17.9 1.1 15.2 0 12 0 7.4 0 3.4 2.7 1.4 6.5l4 3.1C6.3 6.9 8.9 4.8 12 4.8z"
      />
    </svg>
  );
}

function MemberModal({ value, onClose, onSave, members, lineage = {}, displayDots = {}, dotList = [] }) {
  const [form, setForm] = useState({
    spouseDob: "",
    relation: "",
    gender: "male",
    ...value,
  });
  const [customRelation, setCustomRelation] = useState(
    Boolean(value?.relation && !RELATION_CHOICES.includes(value.relation))
  );
  const [unlockParent, setUnlockParent] = useState(false);
  const [applyFamily, setApplyFamily] = useState(true);
  const [photoChange, setPhotoChange] = useState(undefined);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [previewBroken, setPreviewBroken] = useState(false);
  const fileRef = useRef(null);
  const savedPhoto = useMemberPhoto(value);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const typedLink = normalizePhotoUrl(form.photo);
  const linkChanged = typedLink !== normalizePhotoUrl(value?.photo);
  const linkProblem = describePhotoLink(form.photo);
  const linkPreview = previewBroken ? "" : typedLink;
  const previewPhoto =
    photoChange?.portrait ||
    (photoChange === null || linkChanged ? linkPreview : savedPhoto || linkPreview);

  async function applyPicture(source) {
    setPhotoError("");
    if (source instanceof File && source.size > 25 * 1024 * 1024) {
      setPhotoError("This file is larger than 25 MB. Choose a smaller photo.");
      return;
    }
    setPhotoBusy(true);
    try {
      setPhotoChange(await preparePortrait(source));
      setPreviewBroken(false);
    } catch (err) {
      setPhotoError(err.message || "Could not use this photo.");
    } finally {
      setPhotoBusy(false);
    }
  }

  function removePhoto() {
    setPhotoChange(null);
    setPhotoError("");
    set("photo", "");
  }
  const siblingSlots = nextBirthOrder(members, form.parentId, form.id);
  const childNumber = Math.min(
    Math.max(Math.round(Number(form.birthOrder)) || siblingSlots, 1),
    siblingSlots
  );
  const previewDraft = { ...form, birthOrder: childNumber - 0.5 };
  const previewMembers = [
    ...members.filter((m) => m.id !== form.id),
    { ...previewDraft, generation: Number(form.generation) || 1 },
  ];
  const previewCode =
    previewLineageCode(members, previewDraft) || computeLineageCodes(previewMembers)[form.id] || "—";
  const targetDot = Number(form.targetDot) || 0;
  const needsParent = Boolean(form.isNew && !form.isFounding);
  const descendants = new Set();
  if (!form.isNew) {
    const queue = [form.id];
    while (queue.length) {
      const id = queue.shift();
      for (const m of members) {
        if (m.parentId === id && !descendants.has(m.id)) {
          descendants.add(m.id);
          queue.push(m.id);
        }
      }
    }
  }
  const dotOf = (m) => displayDots[m.id] || generationFromLineage(lineage[m.id], m, members);
  const parentChoices = members
    .filter((m) => m.id !== form.id && !descendants.has(m.id))
    .filter((m) => targetDot < 2 || m.id === form.parentId || dotOf(m) < targetDot)
    .sort((a, b) => compareLineageCodes(lineage[a.id], lineage[b.id]));
  const parentGroups = [];
  for (const m of parentChoices) {
    const dot = dotOf(m);
    let group = parentGroups.find((g) => g.dot === dot);
    if (!group) parentGroups.push((group = { dot, people: [] }));
    group.people.push(m);
  }
  parentGroups.sort((a, b) => a.dot - b.dot);
  const selectedParent = members.find((m) => m.id === form.parentId) || null;
  const generation = selectedParent
    ? generationFromLineage(lineage[selectedParent.id], selectedParent, members) + 1
    : form.isFounding || !form.isNew
      ? Number(form.generation) || 1
      : 0;
  const autoDot = selectedParent
    ? dotOf(selectedParent) + 1
    : form.isFounding || !form.isNew
      ? displayDots[form.id] || Number(form.generation) || 1
      : 0;
  const pinnedDot = Math.round(Number(form.dot)) || 0;
  const shownDot = pinnedDot > autoDot ? pinnedDot : autoDot;
  const lastDot = Math.max(autoDot, ...dotList.map(Number).filter(Number.isFinite));
  const dotOptions = [];
  for (let d = autoDot + 1; autoDot > 1 && d <= lastDot + 1; d += 1) dotOptions.push(d);
  const siblings = selectedParent
    ? members.filter((m) => m.parentId === selectedParent.id && m.id !== form.id)
    : [];
  const parentLocked = Boolean(form.isNew && value?.parentId && !targetDot && !unlockParent);
  const relationSelectValue = customRelation
    ? "__custom__"
    : RELATION_CHOICES.includes(form.relation || "")
      ? form.relation
      : "";

  return (
    <div className="modal-back" onClick={onClose}>
      <form
        className="modal glass wide"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (needsParent && !selectedParent) return;
          onSave(
            {
            ...form,
            birthOrder: childNumber,
            photo: photoChange ? "" : typedLink,
            generation: generation || 1,
            dot: shownDot > autoDot ? shownDot : "",
            shownDot,
            gender: normalizeGender(form.gender),
            relation: String(form.relation || "").trim(),
            spouseDob: form.spouseDob || "",
            branch:
              form.branch ||
              form.relation ||
              (previewCode !== "—" ? `AD · ${previewCode}` : ""),
            },
            {
              familyDot: applyFamily && siblings.length > 0,
              photo:
                photoChange !== undefined
                  ? photoChange
                  : linkChanged && value?.photoUpdatedAt
                    ? null
                    : undefined,
            }
          );
        }}
      >
        <p className="kicker">Lineage</p>
        <h2>{form.isNew ? "Add family member" : "Edit family member"}</h2>
        <div className="placement">
          <div>
            <span className="placement-label">Lineage number</span>
            <strong>{formatLineageLabel(previewCode === "—" ? "" : previewCode) || "—"}</strong>
          </div>
          <div>
            <span className="placement-label">Generation</span>
            <strong>{generation || "—"}</strong>
          </div>
          <div>
            <span className="placement-label">Shown in Dot</span>
            <strong>{shownDot ? `${shownDot}.` : "—"}</strong>
          </div>
          <p className="placement-note">
            {selectedParent
              ? `Child of ${displayMemberName(selectedParent)}${
                  selectedParent.spouse ? ` & ${selectedParent.spouse}` : ""
                } (Dot ${dotOf(selectedParent)}) · shown in Dot ${shownDot}${
                  shownDot > autoDot ? " (chosen by Admin)" : ""
                }.`
              : needsParent
                ? "Choose the parent first. The number and Dot are worked out from that parent."
                : "Founding couple · Dot 1."}
          </p>
        </div>
        <div className="grid-2">
          <label>
            Full name
            <input value={form.name} onChange={(e) => set("name", e.target.value)} required />
          </label>
          {parentLocked ? (
            <div className="parent-locked">
              <span className="parent-locked-label">Parent</span>
              <strong>
                {formatLineageLabel(lineage[selectedParent?.id])} {displayMemberName(selectedParent)}
              </strong>
              {selectedParent?.spouse && <span className="muted">& {selectedParent.spouse}</span>}
              <button type="button" className="link" onClick={() => setUnlockParent(true)}>
                Change parent
              </button>
            </div>
          ) : (
            <label>
              Parent
              <select
                value={form.parentId}
                required={needsParent}
                onChange={(e) => {
                  const parentId = e.target.value;
                  const parent = members.find((m) => m.id === parentId);
                  setForm((f) => ({
                    ...f,
                    parentId,
                    birthOrder:
                      parentId === (value?.parentId || "") && !value?.isNew
                        ? value.birthOrder
                        : nextBirthOrder(members, parentId, f.id),
                    dot:
                      parentId === (value?.parentId || "") && !value?.isNew
                        ? value.dot || ""
                        : familyDot(members, parentId, f.id) || targetDot || "",
                    branch: parent
                      ? `AD · ${lineage[parent.id] || parent.name}`
                      : "Dot 1 · Root",
                  }));
                }}
              >
                <option value="">{needsParent ? "Choose a parent…" : "None (founding / Dot 1)"}</option>
                {parentGroups.map((group) => (
                  <optgroup key={group.dot} label={`Parents in Dot ${group.dot}`}>
                    {group.people.map((m) => (
                      <option key={m.id} value={m.id}>
                        {formatLineageLabel(lineage[m.id])} · {displayMemberName(m)}
                        {m.spouse ? ` & ${m.spouse}` : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {targetDot > 1 && (
                <span className="field-hint">
                  Adding to Dot {targetDot} · choose the parent from any Dot above it
                </span>
              )}
            </label>
          )}
          {selectedParent && autoDot > 1 && (
            <label>
              Show in Dot
              <select
                value={shownDot > autoDot ? String(shownDot) : ""}
                onChange={(e) => set("dot", e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">Automatic · Dot {autoDot} (under the parent)</option>
                {dotOptions.map((d) => (
                  <option key={d} value={String(d)}>
                    Dot {d}
                  </option>
                ))}
              </select>
              {siblings.length > 0 && (
                <span className="check-row">
                  <input
                    type="checkbox"
                    checked={applyFamily}
                    onChange={(e) => setApplyFamily(e.target.checked)}
                  />
                  Move brothers &amp; sisters too ({siblings.length})
                </span>
              )}
            </label>
          )}
          {form.parentId && (
            <label>
              Child number
              <input
                type="number"
                min="1"
                max={siblingSlots}
                value={form.birthOrder ?? childNumber}
                onChange={(e) => set("birthOrder", e.target.value)}
              />
            </label>
          )}
          <label>
            Birth order / relation
            <select
              value={relationSelectValue}
              onChange={(e) => {
                const next = e.target.value;
                if (next === "__custom__") {
                  setCustomRelation(true);
                  if (RELATION_CHOICES.includes(form.relation || "")) set("relation", "");
                  return;
                }
                setCustomRelation(false);
                set("relation", next);
              }}
            >
              <option value="">Select relation</option>
              {RELATION_CHOICES.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
              <option value="__custom__">Custom relation</option>
            </select>
          </label>
          {customRelation && (
            <label>
              Custom relation
              <input
                value={form.relation || ""}
                onChange={(e) => set("relation", e.target.value)}
                placeholder="e.g. Adopted son"
              />
            </label>
          )}
          <label>
            Gender
            <select
              value={normalizeGender(form.gender)}
              onChange={(e) => set("gender", e.target.value)}
            >
              <option value="male">Male · Pa</option>
              <option value="female">Female · Nu</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>
            Date of birth
            <input type="date" value={form.dob || ""} onChange={(e) => set("dob", e.target.value)} />
          </label>
          <label>
            Date of departure
            <input type="date" value={form.dod || ""} onChange={(e) => set("dod", e.target.value)} />
          </label>
          <label>
            Spouse
            <input value={form.spouse || ""} onChange={(e) => set("spouse", e.target.value)} />
          </label>
          <label>
            Spouse date of birth
            <input
              type="date"
              value={form.spouseDob || ""}
              onChange={(e) => set("spouseDob", e.target.value)}
            />
          </label>
          <label>
            Branch (AD)
            <input value={form.branch || ""} onChange={(e) => set("branch", e.target.value)} />
          </label>
        </div>
        <div className="photo-field">
          <div className="photo-field-preview">
            {previewPhoto ? (
              <img src={previewPhoto} alt="Profile photo preview" onError={() => setPreviewBroken(true)} />
            ) : (
              <span>Photo</span>
            )}
          </div>
          <div className="photo-field-body">
            <span className="photo-field-label">Profile photo</span>
            <div className="photo-field-actions">
              <button
                type="button"
                className="btn gold"
                disabled={photoBusy}
                onClick={() => fileRef.current?.click()}
              >
                {photoBusy ? "Preparing…" : previewPhoto ? "Change photo" : "Upload photo"}
              </button>
              {previewPhoto && (
                <button type="button" className="btn ghost" disabled={photoBusy} onClick={removePhoto}>
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
                  if (file) applyPicture(file);
                }}
              />
            </div>
            {photoError && <span className="field-error">{photoError}</span>}
            <label className="photo-link">
              Or paste an image link
              <input
                type="url"
                inputMode="url"
                value={form.photo || ""}
                onChange={(e) => {
                  const next = e.target.value;
                  if (/^data:image\//i.test(next.trim())) {
                    set("photo", "");
                    applyPicture(next.trim());
                    return;
                  }
                  setPreviewBroken(false);
                  set("photo", next);
                }}
                placeholder="https://… or a Google Drive share link"
              />
            </label>
            {linkProblem && <span className="field-error">{linkProblem}</span>}
          </div>
        </div>
        <label>
          Biography / note
          <textarea rows={5} value={form.bio} onChange={(e) => set("bio", e.target.value)} />
        </label>
        <div className="row">
          <button className="btn gold" type="submit">
            Save to chronicle
          </button>
          <button className="btn ghost" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function EventModal({ value, onClose, onSave }) {
  const [form, setForm] = useState(value);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <div className="modal-back" onClick={onClose}>
      <form
        className="modal glass"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onSave(form);
        }}
      >
        <p className="kicker">History</p>
        <h2>{form.isNew ? "Add timeline event" : "Edit timeline event"}</h2>
        <label>
          Year / era
          <input value={form.year} onChange={(e) => set("year", e.target.value)} required />
        </label>
        <label>
          Title
          <input value={form.title} onChange={(e) => set("title", e.target.value)} required />
        </label>
        <label>
          Account
          <textarea rows={5} value={form.body} onChange={(e) => set("body", e.target.value)} required />
        </label>
        <div className="row">
          <button className="btn gold" type="submit">
            Save
          </button>
          <button className="btn ghost" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
