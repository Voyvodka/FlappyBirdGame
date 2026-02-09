import {
  extractClientIp,
  rateLimit,
  sanitizeUsernameInput,
  verifyAndStoreChunk
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
    res.status(405).json({ accepted: false, reason: "method_not_allowed" });
    return;
  }

  try {
    const json = readJson(req.body);
    const username = sanitizeUsernameInput(json.username);
    if (!username) {
      res.status(400).json({ accepted: false, reason: "invalid_username" });
      return;
    }

    const ip = extractClientIp(req);
    const ipAllowed = await rateLimit("chunk_ip", ip, 180);
    if (!ipAllowed) {
      res.status(429).json({ accepted: false, reason: "rate_limited" });
      return;
    }

    const usernameAllowed = await rateLimit("chunk_username", username, 150);
    if (!usernameAllowed) {
      res.status(429).json({ accepted: false, reason: "rate_limited" });
      return;
    }

    const check = await verifyAndStoreChunk(username, json.session, json.chunk);
    if (!check.ok) {
      res.status(400).json({ accepted: false, reason: check.reason });
      return;
    }

    res.status(200).json({ accepted: true });
  } catch {
    res.status(500).json({ accepted: false, reason: "internal_error" });
  }
}
