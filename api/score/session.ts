import {
  createSession,
  extractClientIp,
  rateLimit,
  sanitizeUsernameInput
} from "../_lib/scoreSecurity.js";

const readJson = (body: unknown): Record<string, unknown> => {
  if (!body) {
    return {};
  }
  if (typeof body === "string") {
    try {
      return JSON.parse(body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof body === "object") {
    return body as Record<string, unknown>;
  }
  return {};
};

export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  try {
    const json = readJson(req.body);
    const ip = extractClientIp(req);
    const username = sanitizeUsernameInput(json.username);
    if (!username) {
      res.status(400).json({ error: "invalid_username" });
      return;
    }

    const ipAllowed = await rateLimit("session_ip", ip, 40);
    if (!ipAllowed) {
      res.status(429).json({ error: "rate_limited" });
      return;
    }

    const usernameAllowed = await rateLimit("session_username", username, 30);
    if (!usernameAllowed) {
      res.status(429).json({ error: "rate_limited" });
      return;
    }

    const { session } = await createSession(username);

    res.status(200).json({ session });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    res.status(400).json({ error: message });
  }
}
