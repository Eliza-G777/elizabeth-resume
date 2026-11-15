import { isAdmin } from "../lib/auth.mjs";
import { FILE_KEY, contentStore, fileStore } from "../lib/store.mjs";
import { defaultContent } from "../lib/default-content.mjs";
import { publicFileKeys } from "../lib/validate.mjs";

// Serves uploaded photos and documents at /files/<key>.
// Files of hidden documents (and uploads not yet saved) are only served to the logged-in admin.
export default async (req, context) => {
  const key = context.params?.key ?? new URL(req.url).pathname.split("/").pop();
  if (!FILE_KEY.test(key)) return new Response("Not found", { status: 404 });

  const content = (await contentStore().get("content", { type: "json" })) ?? defaultContent;
  const isPublic = publicFileKeys(content).has(key);
  if (!isPublic && !isAdmin(req)) return new Response("Not found", { status: 404 });

  const entry = await fileStore().getWithMetadata(key, { type: "arrayBuffer" });
  if (entry === null) return new Response("Not found", { status: 404 });

  const { data, metadata } = entry;
  const safeName = String(metadata?.name || key).replace(/[^\w.\- ]+/g, "_");
  return new Response(data, {
    headers: {
      "content-type": metadata?.type || "application/octet-stream",
      "content-disposition": `inline; filename="${safeName}"`,
      // Short browser cache only, so hiding a document takes effect within minutes.
      "cache-control": isPublic ? "private, max-age=300" : "private, no-store",
      "x-content-type-options": "nosniff"
    }
  });
};

export const config = { path: "/files/:key", method: "GET" };
