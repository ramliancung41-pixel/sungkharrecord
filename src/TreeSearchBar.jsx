import { useEffect, useId, useMemo, useRef, useState } from "react";
import { displayMemberName, formatLineageLabel } from "./lineage";

export default function TreeSearchBar({
  query,
  onQuery,
  generation,
  onGeneration,
  branch,
  onBranch,
  generations,
  branches,
  matchCount,
  totalCount,
  results = [],
  onPick,
}) {
  const listId = useId();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const hasQuery = Boolean(String(query || "").trim());
  const showList = open && hasQuery;

  const items = useMemo(() => results.slice(0, 12), [results]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    function onDoc(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, []);

  function pick(member) {
    if (!member) return;
    onPick?.(member);
    setOpen(false);
  }

  function onKeyDown(e) {
    if (!hasQuery) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      if (items[active]) {
        e.preventDefault();
        pick(items[active]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <form
      ref={rootRef}
      className="tree-search glass"
      onSubmit={(e) => {
        e.preventDefault();
        if (items[0]) pick(items[active] || items[0]);
      }}
      role="search"
    >
      <label className="tree-search-field tree-search-query">
        <span>Search</span>
        <input
          type="search"
          value={query}
          onChange={(e) => {
            onQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Name, lineage number, generation, or branch"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="search"
          inputMode="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && items[active] ? `${listId}-${items[active].id}` : undefined}
        />
        {showList && (
          <ul id={listId} className="search-results" role="listbox">
            {items.length === 0 ? (
              <li className="search-results-empty" role="option" aria-disabled="true">
                No matching members
              </li>
            ) : (
              items.map((member, index) => {
                const code = formatLineageLabel(member.lineage || member.code || member.generation);
                const name = displayMemberName(member);
                const detail = [
                  code ? `${code}` : "",
                  member.generation ? `Dot ${member.generation}` : "",
                  member.relation || member.branch || "",
                  member.spouse ? `Spouse ${member.spouse}` : "",
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <li key={member.id} role="presentation">
                    <button
                      type="button"
                      id={`${listId}-${member.id}`}
                      role="option"
                      aria-selected={index === active}
                      className={`search-result ${index === active ? "active" : ""}`}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => pick(member)}
                    >
                      <strong>{name}</strong>
                      <span>{detail}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        )}
      </label>
      <label className="tree-search-field">
        <span>Generation</span>
        <select value={generation} onChange={(e) => onGeneration(e.target.value)}>
          <option value="">All dots</option>
          {generations.map((g) => (
            <option key={g} value={String(g)}>
              {g}.
            </option>
          ))}
        </select>
      </label>
      <label className="tree-search-field">
        <span>Branch</span>
        <select value={branch} onChange={(e) => onBranch(e.target.value)}>
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </label>
      <p className="tree-search-count">
        {matchCount === totalCount
          ? `${totalCount} members`
          : `${matchCount} of ${totalCount} members`}
      </p>
    </form>
  );
}
