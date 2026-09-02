import { useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import { useData } from "./DataContext";
import MediaDrawer from "./AdminMediaPanel";
import MediaGallery from "./MediaGallery";

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function newId(prefix) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
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
  const [focusId, setFocusId] = useState("");
  const [mediaOpen, setMediaOpen] = useState(false);

  useEffect(() => {
    setOriginDraft(data.chronicle);
  }, [data.chronicle]);

  const members = data.members || [];
  const byId = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members]);

  const generations = useMemo(() => {
    const map = new Map();
    const declared = Array.isArray(data.dots) ? data.dots : [];
    for (const d of declared) {
      const g = Number(d);
      if (Number.isFinite(g) && g > 0) map.set(g, []);
    }
    for (const m of members) {
      const g = Number(m.generation) || 1;
      if (!map.has(g)) map.set(g, []);
      map.get(g).push(m);
    }
    if (map.size === 0) map.set(1, []);
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [members, data.dots]);

  function childrenOf(id) {
    return members.filter((m) => m.parentId === id);
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

  function openNewMember(generation = 1, parentId = "") {
    setMemberForm({
      id: newId("m"),
      name: "",
      generation,
      parentId,
      spouse: "",
      dob: "",
      dod: "",
      gender: "male",
      branch: parentId ? `AD — ${byId[parentId]?.name || "branch"}` : "Root house",
      bio: "",
      isNew: true,
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
                  <button className="link" onClick={() => setEventForm({ ...ev })}>
                    Edit
                  </button>
                  <button
                    className="link danger"
                    onClick={() => saveTimeline(data.timeline.filter((t) => t.id !== ev.id))}
                  >
                    Delete
                  </button>
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
                Add member
              </button>
            </div>
          )}
        </div>
        <p className="hint">
          Each Dot is a generation container. Admins can add a new Dot, then add family members
          directly into that Dot. Select a card for birth details and AD branch.
        </p>
        <div className="tree-wrap">
          {generations.map(([gen, people]) => (
            <section key={gen} id={`dot-${gen}`} className="gen-row glass dot-section">
              <div className="dot-section-head">
                <div>
                  <div className="dot-badge">Dot {gen}</div>
                  <p className="muted dot-count">
                    {people.length
                      ? `${people.length} family member${people.length === 1 ? "" : "s"}`
                      : "Empty generation — add the first family"}
                  </p>
                </div>
                {isAdmin && (
                  <div className="dot-section-actions">
                    <button
                      className="btn gold"
                      type="button"
                      onClick={() =>
                        openNewMember(
                          gen,
                          gen > 1
                            ? members.find((m) => Number(m.generation) === gen - 1)?.id || ""
                            : ""
                        )
                      }
                    >
                      Add Family / Add Member to this Dot
                    </button>
                    {!people.length && (
                      <button
                        className="btn ghost danger-btn"
                        type="button"
                        onClick={async () => {
                          if (!window.confirm(`Delete empty Dot ${gen}?`)) return;
                          try {
                            await deleteDot(gen);
                          } catch (err) {
                            window.alert(err.message || "Could not delete Dot.");
                          }
                        }}
                      >
                        Delete Dot
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="nodes">
                {!people.length && (
                  <div className="dot-empty">
                    <p>No members in Dot {gen} yet.</p>
                    {isAdmin && (
                      <button
                        className="link"
                        type="button"
                        onClick={() => openNewMember(gen, "")}
                      >
                        Add the first member here
                      </button>
                    )}
                  </div>
                )}
                {people.map((m) => {
                  const parent = byId[m.parentId];
                  const kids = childrenOf(m.id);
                  const active = focusId === m.id;
                  return (
                    <article
                      key={m.id}
                      className={`node glass ${active ? "active note-open" : ""} ${m.gender}`}
                      onClick={() => setFocusId((id) => (id === m.id ? "" : m.id))}
                      title={active ? "Click to hide note" : "Click to show note"}
                    >
                      {parent && <div className="stem" title={`Child of ${parent.name}`} />}
                      <p className="node-gen">Dot {m.generation}</p>
                      <h3>{m.name}</h3>
                      <p className="muted">{m.branch || "Unmarked branch"}</p>
                      <dl>
                        <div>
                          <dt>Born</dt>
                          <dd>{formatDate(m.dob)}</dd>
                        </div>
                        {m.dod && (
                          <div>
                            <dt>Departed</dt>
                            <dd>{formatDate(m.dod)}</dd>
                          </div>
                        )}
                      </dl>
                      {m.spouse && <p className="spouse">Spouse · {m.spouse}</p>}
                      {parent && <p className="parent">Child of {parent.name}</p>}
                      {kids.length > 0 && (
                        <p className="kids">{kids.length} descendant{kids.length === 1 ? "" : "s"}</p>
                      )}
                      {active && (
                        <div className="node-note" onClick={(e) => e.stopPropagation()}>
                          <div className="node-note-head">
                            <span>Note</span>
                            <button
                              type="button"
                              className="link"
                              onClick={() => setFocusId("")}
                            >
                              Close
                            </button>
                          </div>
                          <p>{m.bio?.trim() ? m.bio : "No note recorded for this member yet."}</p>
                        </div>
                      )}
                      {isAdmin && (
                        <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                          <button className="link" onClick={() => setMemberForm({ ...m })}>
                            Edit
                          </button>
                          <button
                            className="link"
                            onClick={() => openNewMember(Number(m.generation) + 1, m.id)}
                          >
                            Add child
                          </button>
                          <button className="link danger" onClick={() => deleteMember(m.id)}>
                            Delete
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
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
          value={memberForm}
          onClose={() => setMemberForm(null)}
          onSave={async (next) => {
            const { isNew, ...rest } = next;
            await upsertMember(rest);
            setMemberForm(null);
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

function MemberModal({ value, onClose, onSave, members }) {
  const [form, setForm] = useState(value);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="modal-back" onClick={onClose}>
      <form
        className="modal glass wide"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ ...form, generation: Number(form.generation) || 1 });
        }}
      >
        <p className="kicker">Lineage</p>
        <h2>{form.isNew ? "Add family member" : "Edit family member"}</h2>
        <div className="grid-2">
          <label>
            Full name
            <input value={form.name} onChange={(e) => set("name", e.target.value)} required />
          </label>
          <label>
            Dot (generation)
            <input
              type="number"
              min="1"
              value={form.generation}
              onChange={(e) => set("generation", e.target.value)}
              required
            />
          </label>
          <label>
            Parent
            <select value={form.parentId} onChange={(e) => set("parentId", e.target.value)}>
              <option value="">None (founding / Dot 1)</option>
              {members
                .filter((m) => m.id !== form.id)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · Dot {m.generation}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Branch (AD)
            <input value={form.branch} onChange={(e) => set("branch", e.target.value)} />
          </label>
          <label>
            Date of birth
            <input type="date" value={form.dob} onChange={(e) => set("dob", e.target.value)} />
          </label>
          <label>
            Date of departure
            <input type="date" value={form.dod} onChange={(e) => set("dod", e.target.value)} />
          </label>
          <label>
            Spouse
            <input value={form.spouse} onChange={(e) => set("spouse", e.target.value)} />
          </label>
          <label>
            Gender
            <select value={form.gender} onChange={(e) => set("gender", e.target.value)}>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </label>
        </div>
        <label>
          Note
          <textarea rows={4} value={form.bio} onChange={(e) => set("bio", e.target.value)} />
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
