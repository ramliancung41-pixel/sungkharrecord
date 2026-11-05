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

/** Deceased when an Admin ticked "Passed away" or a date of departure is recorded. */
export function isDeceased(member) {
  return member?.deceased === true || Boolean(String(member?.dod || "").trim());
}

function yearOf(value) {
  const match = String(value || "").match(/\d{4}/);
  return match ? match[0] : "";
}

export function lifeYears(member) {
  const born = yearOf(member?.dob);
  const died = yearOf(member?.dod);
  if (!born && !died) return "";
  return `${born || "?"} – ${died || "?"}`;
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
