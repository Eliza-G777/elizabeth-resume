import { getStore } from "@netlify/blobs";

export const contentStore = () => getStore({ name: "site-content", consistency: "strong" });
export const fileStore = () => getStore({ name: "site-files" });

export const FILE_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|gif|pdf)$/;

export const ALLOWED_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf"
};

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // Netlify functions accept ~4.5 MB of binary per request
