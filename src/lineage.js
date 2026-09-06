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

/** Canonical Dot 1 founding couple. */
export const ROOT_FATHER_NAME = "Pu Tai Lio";
export const ROOT_MOTHER_NAME = "Pi Tuak Tlem";

export function formatLineageLabel(code) {
  const c = String(code || "").replace(/\.+$/, "");
  if (!c) return "";
  return c.includes(".") ? c : `${c}.`;
}

function nameOf(m) {
  return String(m?.name || "").replace(/\s+/g, " ").trim();
}

export function isPuTaiLio(m) {
  const n = nameOf(m);
  return /pu\s*tai\s*lio/i.test(n) || /tai\s*lio/i.test(n);
}

export function isPiTuakTlem(m) {
  const n = nameOf(m);
  return /pi\s*tuak\s*tlem/i.test(n) || /tuak\s*tlem/i.test(n);
}

export function displayMemberName(member) {
  return nameOf(member);
}

export function emptyRootSlot(role, partnerName = "") {
  const isFather = role === "pa";
  return {
    id: `empty-root-${role}`,
    name: "",
    generation: 1,
    parentId: "",
    spouse: partnerName || "",
    dob: "",
    dod: "",
    gender: isFather ? "male" : "female",
    branch: isFather ? "Father · Root" : "Mother · Root",
    bio: "",
    emptySlot: true,
    virtual: true,
    role,
  };
}

export function defaultRootMother(father) {
  return {
    id: "m-wife",
    name: ROOT_MOTHER_NAME,
    generation: 1,
    parentId: "",
    spouse: nameOf(father) || ROOT_FATHER_NAME,
    dob: "",
    dod: "",
    gender: "female",
    branch: "Mother · Root",
    bio: "",
  };
}

function childrenOf(members, parentId) {
  return members.filter((m) => m.parentId === parentId).sort(byBirthOrder);
}

function isSpouseOf(a, b) {
  if (!a || !b || a.id === b.id) return false;
  if (isPuTaiLio(a) && isPiTuakTlem(b)) return true;
  if (isPiTuakTlem(a) && isPuTaiLio(b)) return true;
  const an = nameOf(a).toLowerCase();
  const bn = nameOf(b).toLowerCase();
  const as = String(a.spouse || "").trim().toLowerCase();
  const bs = String(b.spouse || "").trim().toLowerCase();
  if (!an || !bn) return false;
  return as === bn || bs === an;
}

export function findPrimaryRoot(members = []) {
  const list = members.filter(Boolean);
  return (
    list.find(isPuTaiLio) ||
    list.find((m) => childrenOf(list, m.id).length > 0 && (Number(m.generation) || 1) === 1) ||
    list.find((m) => childrenOf(list, m.id).length > 0) ||
    list[0] ||
    null
  );
}

export function findRootSpouse(members = [], root) {
  const list = members.filter(Boolean);
  if (!root) return null;
  return (
    list.find((m) => m.id !== root.id && isPiTuakTlem(m)) ||
    list.find((m) => m.id !== root.id && isSpouseOf(m, root) && !m.parentId) ||
    null
  );
}

/**
 * Dot 1 holds only the founding couple (nu le pa).
 * Anyone else without a parent is attached as a child of the root father (Dot 2+).
 */
export function normalizeRootHousehold(members = []) {
  const list = members.filter(Boolean).map((m) => ({ ...m }));
  const root = findPrimaryRoot(list);
  if (!root) return list;

  let spouse = findRootSpouse(list, root);
  if (!spouse) {
    const created = defaultRootMother(root);
    const clash = list.find((m) => m.id === created.id && !isPiTuakTlem(m));
    if (clash) created.id = `${created.id}-${root.id}`;
    list.push(created);
    spouse = created;
  }

  const rootIds = new Set([root.id, spouse.id].filter(Boolean));
  const byId = Object.fromEntries(list.map((m) => [m.id, m]));

  for (const m of list) {
    if (m.id === root.id) {
      m.parentId = "";
      m.generation = 1;
      m.spouse = nameOf(spouse) || ROOT_MOTHER_NAME;
      m.branch = "Father · Root";
      continue;
    }
    if (m.id === spouse.id) {
      m.parentId = "";
      m.generation = 1;
      if (!nameOf(m)) m.name = ROOT_MOTHER_NAME;
      m.spouse = nameOf(root) || ROOT_FATHER_NAME;
      m.gender = m.gender || "female";
      m.branch = "Mother · Root";
      continue;
    }
    const parent = m.parentId ? byId[m.parentId] : null;
    const parentIsRootCouple = Boolean(parent && rootIds.has(parent.id));
    const wasDot1 = Number(m.generation) === 1;
    if (!parent || parentIsRootCouple && spouse && m.parentId === spouse.id) {
      m.parentId = root.id;
    }
    if (m.parentId === root.id) {
      m.generation = 2;
    } else if (wasDot1) {
      m.generation = Math.max(2, (Number(parent?.generation) || 1) + 1);
    }
  }

  return list;
}

export function computeLineageCodes(members = []) {
  const list = normalizeRootHousehold(members);
  const byId = Object.fromEntries(list.map((m) => [m.id, m]));
  const codes = {};
  const root = findPrimaryRoot(list);
  const spouse = findRootSpouse(list, root);

  function assign(id, code) {
    if (!id || codes[id]) return;
    codes[id] = code;
    childrenOf(list, id).forEach((child, index) => {
      assign(child.id, `${code}.${index + 1}`);
    });
  }

  if (root) assign(root.id, "1");
  if (spouse) codes[spouse.id] = "1";

  for (const m of list) {
    if (codes[m.id]) continue;
    if (m.parentId && codes[m.parentId]) {
      const siblings = childrenOf(list, m.parentId);
      const index = siblings.findIndex((s) => s.id === m.id);
      assign(m.id, `${codes[m.parentId]}.${index + 1}`);
      continue;
    }
    if (m.parentId && byId[m.parentId] && !codes[m.parentId] && root) {
      m.parentId = root.id;
      continue;
    }
    codes[m.id] = "1.1";
  }

  if (root) {
    childrenOf(list, root.id).forEach((child, index) => {
      if (!String(codes[child.id] || "").startsWith("1.")) {
        assign(child.id, `1.${index + 1}`);
      }
    });
  }

  return codes;
}

export function generationFromLineage(code, member, members = []) {
  const root = findPrimaryRoot(members);
  const spouse = findRootSpouse(members, root);
  if (member && root && member.id === root.id) return 1;
  if (member && spouse && member.id === spouse.id) return 1;
  const depth = lineageDepth(code);
  if (depth <= 1) return 2;
  return depth;
}
