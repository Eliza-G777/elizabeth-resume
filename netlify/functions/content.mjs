import { json, requireAdmin } from "../lib/auth.mjs";
import { contentStore } from "../lib/store.mjs";
import { defaultContent } from "../lib/default-content.mjs";
import { cleanContent } from "../lib/validate.mjs";

const MAX_BODY = 1024 * 1024;

export default async (req) => {
  const store = contentStore();

  if (req.method === "GET") {
    const saved = await store.get("content", { type: "json" });
    return json(saved ?? defaultContent);
  }

  // PUT: save edits from the admin page
  const denied = requireAdmin(req);
  if (denied) return denied;

  const raw = await req.text();
  if (raw.length > MAX_BODY) return json({ error: "Content is too large to save (limit 1 MB of text)." }, 413);
  let cleaned;
  try {
    cleaned = cleanContent(JSON.parse(raw));
  } catch (e) {
    return json({ error: `Could not save: ${e.message}` }, 400);
  }
  await store.setJSON("content", cleaned);
  return json({ ok: true, content: cleaned });
};

export const config = { path: "/api/content", method: ["GET", "PUT"] };
