function byBirthOrder(a, b) {
  const da = String(a.dob || "9999-12-31");
  const db = String(b.dob || "9999-12-31");
  if (da !== db) return da.localeCompare(db);
  const na = String(a.name || "").localeCompare(String(b.name || ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
  if (na !== 0) return na;
  return String(a.id || "").localeCompare(String(b.id || ""));
}

export function compareLineageCodes(a, b) {
  const pa = String(a || "")
    .split(".")
    .filter(Boolean)
    .map(Number);
  const pb = String(b || "")
    .split(".")
    .filter(Boolean)
    .map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const x = Number.isFinite(pa[i]) ? pa[i] : -1;
    const y = Number.isFinite(pb[i]) ? pb[i] : -1;
    if (x !== y) return x - y;
  }
  return 0;
}

export function lineageDepth(code) {
  return String(code || "")
    .split(".")
    .filter(Boolean).length;
}

export function isMainBloodline(code) {
  const c = String(code || "");
  return c === "1.4" || c.startsWith("1.4.");
}

function childrenOf(members, parentId) {
  return members.filter((m) => m.parentId === parentId).sort(byBirthOrder);
}

function isSpouseOf(a, b) {
  if (!a || !b || a.id === b.id) return false;
  const an = String(a.name || "").trim().toLowerCase();
  const bn = String(b.name || "").trim().toLowerCase();
  const as = String(a.spouse || "").trim().toLowerCase();
  const bs = String(b.spouse || "").trim().toLowerCase();
  if (!an || !bn) return false;
  return as === bn || bs === an;
}

/**
 * Hierarchical IDs from parentage + birth order.
 * Founding head of Dot 1 is "1". Children are 1.1, 1.2, 1.3, 1.4…
 * Grandchildren nest: 1.4.1, 1.4.1.1, 1.4.1.2…
 */
export function computeLineageCodes(members = []) {
  const list = members.filter(Boolean);
  const byId = Object.fromEntries(list.map((m) => [m.id, m]));
  const codes = {};

  function assign(id, code) {
    if (!id || codes[id]) return;
    codes[id] = code;
    childrenOf(list, id).forEach((child, index) => {
      assign(child.id, `${code}.${index + 1}`);
    });
  }

  const unresolvedParent = (m) => !m.parentId || !byId[m.parentId];
  const roots = list.filter(unresolvedParent);
  const heads = roots
    .filter((m) => {
      const hasKids = childrenOf(list, m.id).length > 0;
      if (hasKids) return true;
      const pairedToHead = roots.some(
        (other) => isSpouseOf(m, other) && childrenOf(list, other.id).length > 0
      );
      return !pairedToHead;
    })
    .sort((a, b) => {
      const ga = Number(a.generation) || 1;
      const gb = Number(b.generation) || 1;
      if (ga !== gb) return ga - gb;
      return byBirthOrder(a, b);
    });

  const primary =
    heads.find((m) => (Number(m.generation) || 1) === 1 && childrenOf(list, m.id).length > 0) ||
    heads.find((m) => childrenOf(list, m.id).length > 0) ||
    heads[0];

  if (primary) assign(primary.id, "1");

  for (const head of heads) {
    if (codes[head.id]) continue;
    const g = String(Math.max(1, Number(head.generation) || 1));
    let code = g;
    let n = 1;
    while (Object.values(codes).includes(code)) {
      n += 1;
      code = `${g}.${n}`;
    }
    assign(head.id, code);
  }

  for (const m of list) {
    if (codes[m.id]) continue;
    if (m.parentId && codes[m.parentId]) {
      const siblings = childrenOf(list, m.parentId);
      const index = siblings.findIndex((s) => s.id === m.id);
      assign(m.id, `${codes[m.parentId]}.${index + 1}`);
      continue;
    }
    codes[m.id] = String(Math.max(1, Number(m.generation) || 1));
  }

  return codes;
}

export function generationFromLineage(code) {
  return Math.max(1, lineageDepth(code));
}
