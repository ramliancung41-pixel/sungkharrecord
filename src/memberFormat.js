export function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function genderClass(gender) {
  const g = String(gender || "").toLowerCase();
  if (g === "female" || g === "nu") return "female";
  if (g === "male" || g === "pa") return "male";
  return g;
}

export function genderLabel(gender) {
  const g = genderClass(gender);
  if (g === "male") return "Male · Pa";
  if (g === "female") return "Female · Nu";
  return g ? "Other" : "—";
}

export function resolvedSpouseDob(member, members = []) {
  if (member?.spouseDob) return member.spouseDob;
  const spouseName = String(member?.spouse || "").trim().toLowerCase();
  if (!spouseName) return "";
  const match = members.find(
    (x) => x.id !== member.id && String(x.name || "").trim().toLowerCase() === spouseName
  );
  return match?.dob || "";
}

export function findMemberByName(members = [], name, excludeId = "") {
  const wanted = String(name || "").trim().toLowerCase();
  if (!wanted) return null;
  return (
    members.find((m) => m.id !== excludeId && String(m.name || "").trim().toLowerCase() === wanted) ||
    null
  );
}

export function safeImageUrl(raw) {
  const url = String(raw || "").trim();
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : "";
  } catch {
    return "";
  }
}
