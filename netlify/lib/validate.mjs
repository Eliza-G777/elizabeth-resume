import { FILE_KEY } from "./store.mjs";

const MAX_TEXT = 5000;
const str = (v, max = MAX_TEXT) => (typeof v === "string" ? v.slice(0, max) : "");
const strList = (v, maxItems = 50) => (Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, maxItems).map((x) => x.slice(0, 500)) : []);
const id = (v) => (typeof v === "string" && /^[a-z0-9-]{1,80}$/.test(v) ? v : null);
const fileKey = (v) => (typeof v === "string" && FILE_KEY.test(v) ? v : null);
const cleanFiles = (list) => (Array.isArray(list) ? list : []).slice(0, 30)
  .map((f) => ({ key: fileKey(f?.key), name: str(f?.name, 200), type: str(f?.type, 40), caption: str(f?.caption, 300) }))
  .filter((f) => f.key);
const url = (v) => {
  const s = str(v, 500).trim();
  return s === "" || /^https?:\/\//i.test(s) ? s : "";
};

// Returns a cleaned copy of the content, or throws with a message the admin can act on.
export function cleanContent(input) {
  if (!input || typeof input !== "object") throw new Error("Content must be an object.");
  const p = input.profile || {};
  const profile = {
    name: str(p.name, 120), initials: str(p.initials, 4), tagline: str(p.tagline, 300),
    location: str(p.location, 120), email: str(p.email, 200), phone: str(p.phone, 60),
    showPhone: Boolean(p.showPhone), website: url(p.website), github: url(p.github), linkedin: url(p.linkedin),
    photo: fileKey(p.photo), about: str(p.about),
    facts: (Array.isArray(p.facts) ? p.facts : []).slice(0, 6).map((f) => ({ value: str(f?.value, 20), label: str(f?.label, 120) }))
  };

  const seen = new Set();
  const uniq = (raw, fallback) => {
    let base = id(raw) || fallback;
    let out = base, n = 2;
    while (seen.has(out)) out = `${base}-${n++}`;
    seen.add(out);
    return out;
  };

  const education = (Array.isArray(input.education) ? input.education : []).slice(0, 40).map((e, i) => ({
    id: uniq(e?.id, `edu-${i + 1}`), kind: e?.kind === "note" ? "note" : "school",
    when: str(e?.when, 80), title: str(e?.title, 200), place: str(e?.place, 200),
    text: str(e?.text, 1500), badge: str(e?.badge, 40), current: Boolean(e?.current)
  }));

  const sections = new Set(["programs", "leadership", "honors"]);
  const achievements = (Array.isArray(input.achievements) ? input.achievements : []).slice(0, 100).map((a, i) => ({
    id: uniq(a?.id, `achievement-${i + 1}`),
    section: sections.has(a?.section) ? a.section : "honors",
    category: str(a?.category, 60), title: str(a?.title, 200) || "Untitled achievement", org: str(a?.org, 200),
    dates: str(a?.dates, 80), year: str(a?.year, 12), track: str(a?.track, 200), summary: str(a?.summary, 1500),
    bullets: strList(a?.bullets, 20), tags: strList(a?.tags, 30),
    files: cleanFiles(a?.files)
  }));

  const achievementIds = new Set(achievements.map((a) => a.id));
  const kinds = new Set(["transcript", "certificate"]);
  const documents = (Array.isArray(input.documents) ? input.documents : []).slice(0, 100).map((d, i) => ({
    id: uniq(d?.id, `document-${i + 1}`),
    kind: kinds.has(d?.kind) ? d.kind : "certificate",
    title: str(d?.title, 200) || "Untitled document", issuer: str(d?.issuer, 200),
    date: str(d?.date, 80), year: str(d?.year, 12), note: str(d?.note, 1500),
    public: d?.public !== false,
    achievementId: achievementIds.has(d?.achievementId) ? d.achievementId : "",
    files: cleanFiles(d?.files)
  }));

  const skills = (Array.isArray(input.skills) ? input.skills : []).slice(0, 12).map((s, i) => ({
    id: uniq(s?.id, `skills-${i + 1}`), group: str(s?.group, 100), items: strList(s?.items, 40)
  }));

  return { version: 1, updatedAt: new Date().toISOString(), profile, education, achievements, documents, skills };
}

// What visitors who aren't logged in may see: documents marked hidden are removed.
export function publicView(content) {
  return { ...content, documents: (content.documents || []).filter((d) => d.public !== false) };
}

// Files a visitor may open: the profile photo, achievement credentials and files of visible documents.
export function publicFileKeys(content) {
  const keys = new Set();
  if (content.profile?.photo) keys.add(content.profile.photo);
  for (const a of content.achievements || []) for (const f of a.files || []) keys.add(f.key);
  for (const d of publicView(content).documents) for (const f of d.files || []) keys.add(f.key);
  return keys;
}
