import { FILE_KEY, fileStore } from "../lib/store.mjs";

// Public: serves uploaded photos and certificates at /files/<key>
export default async (req, context) => {
  const key = context.params?.key ?? new URL(req.url).pathname.split("/").pop();
  if (!FILE_KEY.test(key)) return new Response("Not found", { status: 404 });

  const entry = await fileStore().getWithMetadata(key, { type: "arrayBuffer" });
  if (entry === null) return new Response("Not found", { status: 404 });

  const { data, metadata } = entry;
  const safeName = String(metadata?.name || key).replace(/[^\w.\- ]+/g, "_");
  return new Response(data, {
    headers: {
      "content-type": metadata?.type || "application/octet-stream",
      "content-disposition": `inline; filename="${safeName}"`,
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff"
    }
  });
};

export const config = { path: "/files/:key", method: "GET" };
