import {
  clearRunState,
  extractClientIp,
  rateLimit,
  sanitizeUsernameInput,
  upsertLeaderboard,
  verifyChunkConsistency,
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
    const username = sanitizeUsernameInput(json.username);
    if (!username) {
      res.status(400).json({ accepted: false, reason: "invalid_username" });
      return;
    }

    const ipAllowed = await rateLimit("submit_ip", ip, 50);
    if (!ipAllowed) {
      res.status(429).json({ accepted: false, reason: "rate_limited" });
      return;
    }

    const usernameAllowed = await rateLimit("submit_username", username, 35);
    if (!usernameAllowed) {
      res.status(429).json({ accepted: false, reason: "rate_limited" });
      return;
    }

    const sessionCheck = await verifyAndConsumeSession(username, json.session);
    if (!sessionCheck.ok) {
      res.status(400).json({ accepted: false, reason: sessionCheck.reason });
      return;
    }

    const telemetryCheck = verifyTelemetry(json.telemetry);
    if (!telemetryCheck.ok) {
      await clearRunState(sessionCheck.session.sessionId);
      res.status(400).json({ accepted: false, reason: telemetryCheck.reason });
      return;
    }

    const chunkCheck = await verifyChunkConsistency(sessionCheck.session.sessionId, telemetryCheck.clean);
    if (!chunkCheck.ok) {
      await clearRunState(sessionCheck.session.sessionId);
      res.status(400).json({ accepted: false, reason: chunkCheck.reason });
      return;
    }

    const result = await upsertLeaderboard(sessionCheck.username, telemetryCheck.clean.score);
    await clearRunState(sessionCheck.session.sessionId);

    res.status(200).json({
      accepted: true,
      rank: result.rank,
      bestScore: result.bestScore
    });
  } catch {
    res.status(500).json({ accepted: false, reason: "internal_error" });
  }
}
