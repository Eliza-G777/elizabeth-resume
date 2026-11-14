import { configError, isAdmin, json } from "../lib/auth.mjs";

export default async (req) => json({ admin: isAdmin(req), setupProblem: configError() });

export const config = { path: "/api/session", method: "GET" };
