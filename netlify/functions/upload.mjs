import crypto from "node:crypto";
import { json, requireAdmin } from "../lib/auth.mjs";
import { ALLOWED_TYPES, MAX_UPLOAD_BYTES, fileStore } from "../lib/store.mjs";

// Checks the file's first bytes so a renamed file can't pass as an image or PDF.
function sniff(bytes) {
  const b = new Uint8Array(bytes.slice(0, 12));
  const ascii = (from, to) => String.fromCharCode(...b.slice(from, to));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(0, 4) === "GIF8") return "image/gif";
  if (ascii(0, 5) === "%PDF-") return "application/pdf";
  return null;
}

export default async (req) => {
  const denied = requireAdmin(req);
  if (denied) return denied;

  let form;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "Upload must be sent as a form." }, 400);
  }
  const file = form.get("file");
  if (!file || typeof file === "string") return json({ error: "No file was attached." }, 400);
  if (file.size > MAX_UPLOAD_BYTES) {
    return json({ error: `${file.name} is ${(file.size / 1048576).toFixed(1)} MB. The limit is 4 MB per file.` }, 413);
  }

  const bytes = await file.arrayBuffer();
  const type = sniff(bytes);
  if (!type || !ALLOWED_TYPES[type]) {
    return json({ error: `${file.name} isn't a supported file. Upload a JPG, PNG, WebP, GIF or PDF.` }, 415);
  }

  const key = `${crypto.randomUUID()}.${ALLOWED_TYPES[type]}`;
  const name = String(file.name || "file").slice(0, 200);
  await fileStore().set(key, bytes, { metadata: { type, name, size: file.size, uploadedAt: new Date().toISOString() } });
  return json({ ok: true, file: { key, name, type, caption: "" } });
};

export const config = { path: "/api/upload", method: "POST" };
