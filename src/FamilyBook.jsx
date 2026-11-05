import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconBtn, IconPencil, IconPlus, IconTrash } from "./uiIcons";
import {
  compareLineageCodes,
  displayMemberName,
  formatLineageLabel,
  generationFromLineage,
  isMainBloodline,
} from "./lineage";
import {
  findMemberByName,
  formatDate,
  genderClass,
  genderLabel,
  resolvedSpouseDob,
} from "./memberFormat";
import { memberThumb, useMemberPhoto } from "./memberPhotos";

const MOBILE_QUERY = "(max-width: 900px)";

function initials(name) {
  const parts = String(name || "")
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "ST";
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function Portrait({ member, name, isAdmin, onEdit }) {
  const src = useMemberPhoto(member);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [src]);

  return (
    <figure className={`book-portrait ${genderClass(member.gender)} ${src && !loaded ? "loading" : ""}`}>
      {src && !failed ? (
        <img
          key={src.length > 200 ? `${member.id}:${member.photoUpdatedAt}` : src}
          src={src}
          alt={`Portrait of ${name}`}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="book-portrait-empty" aria-label="No profile photo yet">
          <span className="book-portrait-initials">{initials(name)}</span>
          <span className="book-portrait-label">Profile photo</span>
        </div>
      )}
      {isAdmin && (
        <button type="button" className="book-portrait-edit" onClick={onEdit}>
          {src ? "Change photo" : "Add photo"}
        </button>
      )}
    </figure>
  );
}

function PersonChip({ person, lineage, onSelect }) {
  if (!person) return null;
  const code = formatLineageLabel(lineage[person.id]);
  return (
    <button type="button" className="book-chip" onClick={() => onSelect(person.id)}>
      {code && <span className="book-chip-code">{code}</span>}
      <span>{displayMemberName(person)}</span>
    </button>
  );
}

function RelationRow({ label, children }) {
  return (
    <div className="book-relation">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export default function FamilyBook({
  groups,
  members,
  byId,
  lineage,
  displayDots = {},
  childrenOf,
  rootEntriesFor,
  selectedId,
  onSelect,
  highlightId,
  openGens,
  onToggleGen,
  filtering,
  isAdmin,
  onEdit,
  onAddChild,
  onDelete,
  onAddMember,
  onDeleteDot,
  onFoundingSlot,
  revealKey = 0,
}) {
  const detailRef = useRef(null);
  const sheetRef = useRef(null);
  const indexRef = useRef(null);
  const touchRef = useRef(null);
  const sheetHistory = useRef(false);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [turn, setTurn] = useState("");

  const dots = useMemo(
    () =>
      groups.map(([gen, people]) => {
        if (gen === 1) {
          return { gen, families: [{ parentId: "", parent: null, entries: rootEntriesFor(people) }] };
        }
        const byParent = new Map();
        for (const member of people) {
          const parentId = member.parentId || "";
          if (!byParent.has(parentId)) {
            byParent.set(parentId, { parentId, parent: byId[parentId] || null, entries: [] });
          }
          byParent.get(parentId).entries.push({ member });
        }
        const families = [...byParent.values()];
        for (const family of families) {
          family.entries.sort((a, b) =>
            compareLineageCodes(lineage[a.member.id], lineage[b.member.id])
          );
        }
        families.sort((a, b) => compareLineageCodes(lineage[a.parentId], lineage[b.parentId]));
        return { gen, families };
      }),
    [groups, rootEntriesFor, byId, lineage]
  );

  const reading = useMemo(
    () =>
      dots.flatMap(({ families }) =>
        families.flatMap((f) =>
          f.entries.filter((e) => !e.empty && e.member?.id).map((e) => e.member.id)
        )
      ),
    [dots]
  );

  const member = selectedId ? byId[selectedId] : null;
  const showSheet = isMobile && sheetOpen && Boolean(member);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    if (detailRef.current) detailRef.current.scrollTop = 0;
    if (sheetRef.current) sheetRef.current.scrollTop = 0;
    const entry = document.getElementById(`book-entry-${selectedId}`);
    const list = indexRef.current;
    if (entry && list && !isMobile) {
      const top = entry.offsetTop - list.clientHeight / 2 + entry.clientHeight / 2;
      list.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }
  }, [selectedId, isMobile]);

  useEffect(() => {
    if (!showSheet) return undefined;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    function onKey(e) {
      if (e.key === "Escape") closeSheet();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [showSheet]);

  useEffect(() => {
    function onPop() {
      if (!sheetHistory.current) return;
      sheetHistory.current = false;
      setSheetOpen(false);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (revealKey && isMobile) openSheet();
  }, [revealKey]);

  function openSheet() {
    if (!sheetHistory.current) {
      window.history.pushState({ sungkharSheet: true }, "");
      sheetHistory.current = true;
    }
    setSheetOpen(true);
  }

  function closeSheet() {
    const id = selectedId;
    if (sheetHistory.current) {
      sheetHistory.current = false;
      window.history.back();
    }
    setSheetOpen(false);
    window.requestAnimationFrame(() => {
      document.getElementById(`book-entry-${id}`)?.scrollIntoView({ block: "nearest" });
    });
  }

  function select(id, direction = "") {
    if (!id) return;
    setTurn(direction);
    onSelect(id);
    if (isMobile) openSheet();
  }

  const position = member ? reading.indexOf(member.id) : -1;
  const prevId = position > 0 ? reading[position - 1] : "";
  const nextId = position >= 0 && position < reading.length - 1 ? reading[position + 1] : "";

  function onTouchStart(e) {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY, at: Date.now() };
  }

  function onTouchEnd(e) {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.6 || Date.now() - start.at > 700) return;
    if (dx < 0 && nextId) select(nextId, "next");
    if (dx > 0 && prevId) select(prevId, "prev");
  }

  const pageContent = member ? (
          <div key={member.id} className={`book-turn ${turn}`}>
          <MemberPage
            member={member}
            members={members}
            byId={byId}
            lineage={lineage}
            dot={displayDots[member.id]}
            childrenOf={childrenOf}
            isAdmin={isAdmin}
            onSelect={select}
            onEdit={onEdit}
            onAddChild={onAddChild}
            onDelete={onDelete}
            prevId={prevId}
            nextId={nextId}
            pageNumber={position + 1}
            pageCount={reading.length}
          />
          </div>
        ) : (
          <div className="book-blank">
            <p className="kicker">Sungkhar Tuanthu</p>
            <h2>Choose a name</h2>
            <p>Select any member from the family index to read their page.</p>
          </div>
        );

  return (
    <div className="book">
      <article
        ref={detailRef}
        id="book-detail"
        className={`book-page book-detail ${member ? genderClass(member.gender) : ""}`}
        aria-live="polite"
      >
        {!showSheet && pageContent}
      </article>

      {showSheet &&
        createPortal(
          <div className="book-sheet-back">
            <article
              ref={sheetRef}
              className={`book-sheet book-detail ${genderClass(member.gender)}`}
              role="dialog"
              aria-modal="true"
              aria-label={`${displayMemberName(member)} · member page`}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            >
              <div className="book-sheet-bar">
                <button type="button" className="book-sheet-close" onClick={closeSheet}>
                  ‹ Family index
                </button>
                <span className="book-sheet-hint">Swipe ‹ › to turn pages</span>
              </div>
              {pageContent}
            </article>
          </div>,
          document.body
        )}

      <div className="book-spine" aria-hidden="true" />

      <nav ref={indexRef} className="book-page book-index" aria-label="Family index">
        <header className="book-index-head">
          <p className="kicker">Family index</p>
          <p className="muted">
            {reading.length} {reading.length === 1 ? "name" : "names"} · by generation
          </p>
        </header>

        {dots.map(({ gen, families }) => {
          const expanded = filtering || gen === 1 || openGens.has(gen);
          const count = families.reduce((n, f) => n + f.entries.filter((e) => !e.empty).length, 0);
          return (
            <section key={gen} id={`dot-${gen}`} className="book-group">
              <div className="book-group-head">
                <button
                  type="button"
                  className="book-group-toggle"
                  onClick={() => onToggleGen(gen)}
                  aria-expanded={expanded}
                  disabled={gen === 1}
                >
                  <span className="book-group-num">{gen}.</span>
                  <span className="book-group-text">
                    <strong>{gen === 1 ? "Founding couple" : `Dot ${gen}`}</strong>
                    <small>
                      {count
                        ? `${count} member${count === 1 ? "" : "s"}${
                            gen === 1
                              ? ""
                              : ` · ${families.length} ${families.length === 1 ? "family" : "families"}`
                          }`
                        : "Empty generation"}
                    </small>
                  </span>
                  {gen !== 1 && (
                    <span className={`book-group-chevron ${expanded ? "open" : ""}`} aria-hidden="true" />
                  )}
                </button>
                {isAdmin && gen !== 1 && (
                  <div className="book-group-actions">
                    <IconBtn label={`Add member to Dot ${gen}`} onClick={() => onAddMember(gen)}>
                      <IconPlus />
                    </IconBtn>
                    {!count && (
                      <IconBtn label={`Delete empty Dot ${gen}`} danger onClick={() => onDeleteDot(gen)}>
                        <IconTrash />
                      </IconBtn>
                    )}
                  </div>
                )}
              </div>

              {expanded &&
                (families.length ? (
                  families.map((family) => (
                    <div
                      key={family.parentId || "root"}
                      className={`book-family ${family.parent ? "" : "root"}`}
                    >
                      {family.parent && (
                        <FamilyHead
                          parent={family.parent}
                          lineage={lineage}
                          isAdmin={isAdmin}
                          active={family.parent.id === selectedId}
                          onSelect={select}
                          onAddChild={onAddChild}
                        />
                      )}
                      <ul className="book-entries">
                        {family.entries.map((entry) => (
                          <li key={entry.member.id}>
                            <IndexEntry
                              entry={entry}
                              lineage={lineage}
                              members={members}
                              active={!entry.empty && entry.member.id === selectedId}
                              hit={!entry.empty && entry.member.id === highlightId}
                              isAdmin={isAdmin}
                              onSelect={select}
                              onFoundingSlot={onFoundingSlot}
                            />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                ) : (
                  <p className="book-entries-empty">No members yet.</p>
                ))}
            </section>
          );
        })}
      </nav>
    </div>
  );
}

function FamilyHead({ parent, lineage, isAdmin, active, onSelect, onAddChild }) {
  const name = displayMemberName(parent) || "Unnamed";
  const partner = String(parent.spouse || "").trim();
  return (
    <div className="book-family-head">
      <button
        type="button"
        className={`book-family-parent ${active ? "active" : ""}`}
        onClick={() => onSelect(parent.id)}
        title={`Open ${name}`}
      >
        <span className="book-family-label">Children of</span>
        <span className="book-family-name">
          <em>{formatLineageLabel(lineage[parent.id])}</em> {name}
          {partner && <span className="book-family-partner"> &amp; {partner}</span>}
        </span>
      </button>
      {isAdmin && (
        <IconBtn label={`Add child to ${name}`} onClick={() => onAddChild(parent)}>
          <IconPlus />
        </IconBtn>
      )}
    </div>
  );
}

function IndexEntry({ entry, lineage, members, active, hit, isAdmin, onSelect, onFoundingSlot }) {
  const m = entry.member;
  const role = entry.role;
  const roleLabel = role === "pa" ? "Father · Root" : role === "nu" ? "Mother · Root" : "";

  if (entry.empty) {
    return (
      <button
        type="button"
        className="book-entry empty"
        disabled={!isAdmin}
        onClick={() => onFoundingSlot(role)}
      >
        <span className="book-entry-code">1.</span>
        <span className="book-entry-text">
          <strong>Empty slot</strong>
          <small>{isAdmin ? `Add ${roleLabel.toLowerCase()}` : roleLabel}</small>
        </span>
      </button>
    );
  }

  const code = lineage[m.id] || String(m.generation || 1);
  const relation = String(m.relation || "").trim();
  const spouse = String(m.spouse || "").trim();
  const sub = role
    ? roleLabel
    : [relation, spouse ? `Spouse ${spouse}` : ""].filter(Boolean).join(" · ");
  const hasBio = Boolean(String(m.bio || "").trim());
  const gen = generationFromLineage(code, m, members);
  const thumb = memberThumb(m);

  return (
    <button
      type="button"
      id={`book-entry-${m.id}`}
      className={`book-entry ${genderClass(m.gender)} ${active ? "active" : ""} ${hit ? "search-hit" : ""} ${isMainBloodline(code) ? "main-line" : ""}`}
      aria-current={active ? "page" : undefined}
      title={`Dot ${gen} · ${displayMemberName(m)}`}
      onClick={() => onSelect(m.id)}
    >
      <span className="book-entry-code">{formatLineageLabel(code)}</span>
      <span className="book-entry-text">
        <strong>
          {thumb && <img className="book-entry-avatar" src={thumb} alt="" loading="lazy" />}
          {displayMemberName(m) || "Unnamed"}
        </strong>
        {sub && <small>{sub}</small>}
      </span>
      {hasBio && <span className="book-entry-note" title="Has biography" aria-label="Has biography" />}
    </button>
  );
}

function MemberPage({
  member,
  members,
  byId,
  lineage,
  dot,
  childrenOf,
  isAdmin,
  onSelect,
  onEdit,
  onAddChild,
  onDelete,
  prevId,
  nextId,
  pageNumber,
  pageCount,
}) {
  const name = displayMemberName(member) || "Unnamed";
  const code = lineage[member.id] || String(member.generation || 1);
  const gen = generationFromLineage(code, member, members);
  const parent = byId[member.parentId] || null;
  const otherParent = parent ? findMemberByName(members, parent.spouse, parent.id) : null;
  const spouseName = String(member.spouse || "").trim();
  const spouseMember = findMemberByName(members, spouseName, member.id);
  const ownKids = childrenOf(member.id);
  const kids = ownKids.length || !spouseMember ? ownKids : childrenOf(spouseMember.id);
  const siblings = parent ? childrenOf(parent.id).filter((s) => s.id !== member.id) : [];
  const bio = String(member.bio || "").trim();
  const relation = String(member.relation || "").trim();
  const branch = String(member.branch || "").trim();

  return (
    <>
      <header className="book-detail-head">
        <Portrait member={member} name={name} isAdmin={isAdmin} onEdit={() => onEdit(member)} />
        <div className="book-title">
          <p className="book-kicker">
            <span className="lineage-code">{formatLineageLabel(code)}</span>
            <span>
              {gen === 1
                ? "Generation 1 · Ultimate root"
                : `Generation ${gen} · Dot ${dot || gen}`}
            </span>
          </p>
          <h2 className="book-name">{name}</h2>
          {(relation || branch) && <p className="book-subtitle">{relation || branch}</p>}
          {isAdmin && (
            <div className="book-admin" role="group" aria-label="Admin actions">
              <IconBtn label="Edit member" onClick={() => onEdit(member)}>
                <IconPencil />
              </IconBtn>
              <IconBtn label="Add child" onClick={() => onAddChild(member)}>
                <IconPlus />
              </IconBtn>
              <IconBtn label="Delete member" danger onClick={() => onDelete(member)}>
                <IconTrash />
              </IconBtn>
            </div>
          )}
        </div>
      </header>

      <dl className="book-facts">
        <div>
          <dt>Born</dt>
          <dd>{formatDate(member.dob)}</dd>
        </div>
        {member.dod && (
          <div>
            <dt>Departed</dt>
            <dd>{formatDate(member.dod)}</dd>
          </div>
        )}
        <div>
          <dt>Gender</dt>
          <dd>{genderLabel(member.gender)}</dd>
        </div>
        {branch && branch !== relation && (
          <div>
            <dt>Branch</dt>
            <dd>{branch}</dd>
          </div>
        )}
      </dl>

      {spouseName && (
        <div className="spouse-card book-spouse">
          <span className="spouse-card-kicker">Spouse</span>
          {spouseMember ? (
            <button type="button" className="spouse-card-name book-link" onClick={() => onSelect(spouseMember.id)}>
              {spouseName}
            </button>
          ) : (
            <strong className="spouse-card-name">{spouseName}</strong>
          )}
          <span className="spouse-card-dob">Born {formatDate(resolvedSpouseDob(member, members))}</span>
        </div>
      )}

      <section className="book-section">
        <h3>Biography</h3>
        {bio ? (
          <p className="book-bio">{bio}</p>
        ) : (
          <p className="book-bio empty">No biography recorded for {name} yet.</p>
        )}
      </section>

      <section className="book-section">
        <h3>Family</h3>
        <dl className="book-relations">
          {parent && (
            <RelationRow label="Parents">
              <PersonChip person={parent} lineage={lineage} onSelect={onSelect} />
              {otherParent ? (
                <PersonChip person={otherParent} lineage={lineage} onSelect={onSelect} />
              ) : (
                parent.spouse && <span className="book-chip static">{parent.spouse}</span>
              )}
            </RelationRow>
          )}
          {siblings.length > 0 && (
            <RelationRow label={`Siblings · ${siblings.length}`}>
              {siblings.map((s) => (
                <PersonChip key={s.id} person={s} lineage={lineage} onSelect={onSelect} />
              ))}
            </RelationRow>
          )}
          <RelationRow label={`Children · ${kids.length}`}>
            {kids.length ? (
              kids.map((k) => <PersonChip key={k.id} person={k} lineage={lineage} onSelect={onSelect} />)
            ) : (
              <span className="muted">No children recorded.</span>
            )}
          </RelationRow>
        </dl>
      </section>

      <footer className="book-pager">
        <button
          type="button"
          className="btn ghost"
          disabled={!prevId}
          onClick={() => onSelect(prevId, "prev")}
        >
          ‹ Previous
        </button>
        <span className="book-folio">
          {pageNumber > 0 ? `Page ${pageNumber} of ${pageCount}` : ""}
        </span>
        <button
          type="button"
          className="btn ghost"
          disabled={!nextId}
          onClick={() => onSelect(nextId, "next")}
        >
          Next ›
        </button>
      </footer>
    </>
  );
}
