import { json, requireAdmin } from "../lib/auth.mjs";
import { FILE_KEY, fileStore } from "../lib/store.mjs";

export default async (req, context) => {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const key = context.params?.key ?? new URL(req.url).pathname.split("/").pop();
  if (!FILE_KEY.test(key)) return json({ error: "Unknown file." }, 404);
  await fileStore().delete(key);
  return json({ ok: true });
};

export const config = { path: "/api/files/:key", method: "DELETE" };
