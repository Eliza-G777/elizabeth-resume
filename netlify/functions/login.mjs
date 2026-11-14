import { checkPassword, configError, json, sessionCookie } from "../lib/auth.mjs";

export default async (req) => {
  const problem = configError();
  if (problem) return json({ error: `Admin login is not set up yet: ${problem}` }, 500);

  let password = "";
  try {
    ({ password } = await req.json());
  } catch {
    return json({ error: "Send the password as JSON." }, 400);
  }

  if (!checkPassword(password)) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return json({ error: "That password is not correct." }, 401);
  }
  return json({ ok: true }, 200, { "set-cookie": sessionCookie() });
};

export const config = {
  path: "/api/login",
  method: "POST",
  // At most 8 login attempts per minute from one IP address.
  rateLimit: { windowLimit: 8, windowSize: 60, aggregateBy: ["ip", "domain"] }
};
