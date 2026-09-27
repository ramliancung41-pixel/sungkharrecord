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
}) {
  return (
    <form className="tree-search glass" onSubmit={(e) => e.preventDefault()} role="search">
      <label className="tree-search-field tree-search-query">
        <span>Search</span>
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Name, lineage number, generation, or branch"
          autoComplete="off"
        />
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
