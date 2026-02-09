import {
  extractClientIp,
  rateLimit,
  upsertLeaderboard,
  verifyAndConsumeSession,
  verifyTelemetry
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
    const ip = extractClientIp(req);

    const ipAllowed = await rateLimit("submit_ip", ip, 50);
    if (!ipAllowed) {
      res.status(429).json({ accepted: false, reason: "rate_limited" });
      return;
    }

    const sessionCheck = await verifyAndConsumeSession(json.username, json.session);
    if (!sessionCheck.ok) {
      res.status(400).json({ accepted: false, reason: sessionCheck.reason });
      return;
    }

    const telemetryCheck = verifyTelemetry(json.telemetry);
    if (!telemetryCheck.ok) {
      res.status(400).json({ accepted: false, reason: telemetryCheck.reason });
      return;
    }

    const result = await upsertLeaderboard(sessionCheck.username, telemetryCheck.clean.score);

    res.status(200).json({
      accepted: true,
      rank: result.rank,
      bestScore: result.bestScore
    });
  } catch {
    res.status(500).json({ accepted: false, reason: "internal_error" });
  }
}
