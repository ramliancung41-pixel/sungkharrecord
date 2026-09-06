import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { get, onValue, ref, update } from "firebase/database";
import { db, isFirebaseConfigured } from "./firebase";
import { seedData } from "./data/seed";
import { useAuth } from "./AuthContext";
import { computeLineageCodes, generationFromLineage } from "./lineage";

const DataContext = createContext(null);

function cloneSeed() {
  return structuredClone(seedData);
}

function toList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return Object.values(value);
}

export function normalizeDots(dots, members = []) {
  const set = new Set();
  for (const d of toList(dots)) {
    const n = typeof d === "object" ? Number(d.number ?? d.generation) : Number(d);
    if (Number.isFinite(n) && n > 0) set.add(n);
  }
  for (const m of members) {
    const n = Number(m.generation) || 1;
    if (n > 0) set.add(n);
  }
  if (set.size === 0) set.add(1);
  return [...set].sort((a, b) => a - b);
}

function fromSnap(val) {
  if (!val) return cloneSeed();
  const members = toList(val.members);
  return {
    chronicle: val.chronicle || seedData.chronicle,
    timeline: toList(val.timeline),
    members,
    dots: normalizeDots(val.dots ?? seedData.dots, members),
  };
}

export function DataProvider({ children }) {
  const { isAdmin } = useAuth();
  const [data, setData] = useState(cloneSeed);
  const [live, setLive] = useState(!isFirebaseConfigured);
  const [status, setStatus] = useState(
    isFirebaseConfigured ? "Connecting to the living record…" : "Local chronicle (configure Firebase for live sync)"
  );

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLive(true);
      setStatus("Firebase keys missing — cannot sync live.");
      return undefined;
    }

    const root = ref(db, "sungkhar");
    const unsub = onValue(
      root,
      (snap) => {
        const val = snap.val();
        if (!val || (!val.chronicle && !val.members)) {
          setData(cloneSeed());
          setStatus("Live database is empty. An Admin can save to publish the chronicle.");
        } else {
          setData(fromSnap(val));
          setStatus("Live — updates appear for every visitor");
        }
        setLive(true);
      },
      (err) => {
        setLive(false);
        setStatus(err?.message || "Could not read the live record.");
      }
    );
    return unsub;
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured || !isAdmin) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const snap = await get(ref(db, "sungkhar/chronicle"));
        if (!cancelled && !snap.exists()) {
          await update(ref(db, "sungkhar"), cloneSeed());
        }
      } catch {
        /* guest rules or offline */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  async function persist(next) {
    if (!isAdmin) return;
    const members = next.members || [];
    const payload = {
      ...next,
      dots: normalizeDots(next.dots, members),
      members,
    };
    setData(payload);
    if (!isFirebaseConfigured) {
      throw new Error("Firebase is not configured.");
    }
    await update(ref(db, "sungkhar"), {
      chronicle: payload.chronicle,
      timeline: payload.timeline,
      members: payload.members,
      dots: payload.dots,
    });
  }

  const value = useMemo(
    () => ({
      data,
      live,
      status,
      isAdmin,
      async saveChronicle(chronicle) {
        await persist({ ...data, chronicle });
      },
      async saveTimeline(timeline) {
        await persist({ ...data, timeline });
      },
      async saveDots(dots) {
        await persist({ ...data, dots: normalizeDots(dots, data.members) });
      },
      async addDot() {
        const current = normalizeDots(data.dots, data.members);
        const nextNum = (current[current.length - 1] || 0) + 1;
        await persist({ ...data, dots: [...current, nextNum] });
        return nextNum;
      },
      async deleteDot(generation) {
        if (!isAdmin) throw new Error("Only an Admin can delete a Dot.");
        const gen = Number(generation);
        if (!Number.isFinite(gen) || gen < 1) {
          throw new Error("Invalid Dot number.");
        }
        const occupied = (data.members || []).some((m) => Number(m.generation) === gen);
        if (occupied) {
          throw new Error("Only empty Dots can be deleted. Remove members from this Dot first.");
        }
        const current = normalizeDots(data.dots, data.members).filter((d) => d !== gen);
        await persist({ ...data, dots: current });
        return gen;
      },
      async upsertMember(member) {
        const members = [...data.members];
        const idx = members.findIndex((m) => m.id === member.id);
        if (idx >= 0) members[idx] = member;
        else members.push(member);
        const codes = computeLineageCodes(members);
        const synced = members.map((m) => {
          const code = codes[m.id];
          const generation = generationFromLineage(code) || Number(m.generation) || 1;
          return {
            ...m,
            generation,
            lineage: code || m.lineage || "",
          };
        });
        const gen = Number(member.generation) || 1;
        const dots = normalizeDots(
          [...normalizeDots(data.dots, synced), gen, ...synced.map((m) => m.generation)],
          synced
        );
        await persist({ ...data, members: synced, dots });
      },
      async deleteMember(id) {
        const members = data.members
          .filter((m) => m.id !== id)
          .map((m) => (m.parentId === id ? { ...m, parentId: "" } : m));
        await persist({ ...data, members });
      },
    }),
    [data, live, status, isAdmin]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
