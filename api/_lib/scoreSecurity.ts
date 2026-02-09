import { createHmac, randomUUID } from "crypto";
import { kv } from "@vercel/kv";

export const SCOREBOARD_KEY = "scoreboard:global:v1";
const SESSION_PREFIX = "score:session:v1:";
const USED_PREFIX = "score:used:v1:";
const PROFILE_PREFIX = "score:profile:v1:";
const RATE_PREFIX = "score:rl:v1:";

const MIN_SESSION_MS = 15_000;
const MAX_SESSION_MS = 6 * 60_000;

export interface ScoreSessionPayload {
  sessionId: string;
  seed: number;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
  signature: string;
}

interface StoredSession {
  sessionId: string;
  deviceId: string;
  seed: number;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
}

const getSecret = (): string => {
  const secret = process.env.SCORE_SIGNING_SECRET;
  if (!secret) {
    throw new Error("Missing SCORE_SIGNING_SECRET");
  }
  return secret;
};

const signSession = (session: Omit<ScoreSessionPayload, "signature">, deviceId: string): string => {
  const base = [session.sessionId, deviceId, session.seed, session.issuedAt, session.expiresAt, session.nonce].join("|");
  return createHmac("sha256", getSecret()).update(base).digest("hex");
};

const sessionKey = (sessionId: string): string => `${SESSION_PREFIX}${sessionId}`;
const usedKey = (sessionId: string): string => `${USED_PREFIX}${sessionId}`;
const profileKey = (deviceId: string): string => `${PROFILE_PREFIX}${deviceId}`;

const sanitizeDeviceId = (input: unknown): string | null => {
  if (typeof input !== "string") {
    return null;
  }
  const clean = input.trim().toLowerCase();
  if (!/^[a-z0-9-]{8,64}$/.test(clean)) {
    return null;
  }
  return clean;
};

export const safePlayerName = (deviceId: string): string => {
  const suffix = deviceId.slice(-4).toUpperCase();
  return `Pilot-${suffix}`;
};

export const extractClientIp = (req: { headers?: Record<string, string | string[] | undefined> }): string => {
  const header = req.headers?.["x-forwarded-for"];
  if (Array.isArray(header) && header.length > 0) {
    return header[0].split(",")[0].trim();
  }
  if (typeof header === "string" && header.length > 0) {
    return header.split(",")[0].trim();
  }
  return "unknown";
};

export const rateLimit = async (bucket: string, key: string, maxPerMinute: number): Promise<boolean> => {
  const minute = Math.floor(Date.now() / 60_000);
  const redisKey = `${RATE_PREFIX}${bucket}:${key}:${minute}`;
  const count = await kv.incr(redisKey);
  if (count === 1) {
    await kv.expire(redisKey, 70);
  }
  return count <= maxPerMinute;
};

export const createSession = async (deviceIdRaw: unknown): Promise<{ session: ScoreSessionPayload; deviceId: string }> => {
  const deviceId = sanitizeDeviceId(deviceIdRaw);
  if (!deviceId) {
    throw new Error("invalid_device_id");
  }

  const issuedAt = Date.now();
  const expiresAt = issuedAt + 4 * 60_000;
  const session: Omit<ScoreSessionPayload, "signature"> = {
    sessionId: randomUUID(),
    seed: Math.floor(Math.random() * 2_147_483_647),
    issuedAt,
    expiresAt,
    nonce: randomUUID().replace(/-/g, "")
  };

  const signature = signSession(session, deviceId);
  const stored: StoredSession = {
    sessionId: session.sessionId,
    seed: session.seed,
    issuedAt,
    expiresAt,
    nonce: session.nonce,
    deviceId
  };

  await kv.set(sessionKey(session.sessionId), stored, { ex: 5 * 60 });

  return {
    deviceId,
    session: {
      ...session,
      signature
    }
  };
};

export interface TelemetryPayload {
  durationMs: number;
  score: number;
  coins: number;
  nearMisses: number;
  flaps: number;
  passEvents: number[];
  coinEvents: number[];
  nearMissEvents: number[];
  flapEvents: number[];
}

const isMonotonicMs = (events: unknown, durationMs: number): events is number[] => {
  if (!Array.isArray(events)) {
    return false;
  }
  if (events.length > 1500) {
    return false;
  }

  let prev = -1;
  for (const value of events) {
    if (!Number.isInteger(value) || value < 0 || value > durationMs) {
      return false;
    }
    if (value < prev) {
      return false;
    }
    prev = value;
  }
  return true;
};

export const verifyTelemetry = (telemetry: unknown): { ok: true; clean: TelemetryPayload } | { ok: false; reason: string } => {
  if (!telemetry || typeof telemetry !== "object") {
    return { ok: false, reason: "invalid_payload" };
  }

  const t = telemetry as Record<string, unknown>;
  const durationMs = Number(t.durationMs);
  const score = Number(t.score);
  const coins = Number(t.coins);
  const nearMisses = Number(t.nearMisses);
  const flaps = Number(t.flaps);

  if (!Number.isInteger(durationMs) || durationMs < MIN_SESSION_MS || durationMs > MAX_SESSION_MS) {
    return { ok: false, reason: "invalid_duration" };
  }
  if (!Number.isInteger(score) || score < 0 || score > 10_000) {
    return { ok: false, reason: "invalid_score" };
  }
  if (!Number.isInteger(coins) || coins < 0 || coins > 10_000) {
    return { ok: false, reason: "invalid_coins" };
  }
  if (!Number.isInteger(nearMisses) || nearMisses < 0 || nearMisses > 10_000) {
    return { ok: false, reason: "invalid_near_miss" };
  }
  if (!Number.isInteger(flaps) || flaps < 1 || flaps > 20_000) {
    return { ok: false, reason: "invalid_flaps" };
  }

  const passEvents = t.passEvents;
  const coinEvents = t.coinEvents;
  const nearMissEvents = t.nearMissEvents;
  const flapEvents = t.flapEvents;

  if (!isMonotonicMs(passEvents, durationMs)) {
    return { ok: false, reason: "invalid_pass_events" };
  }
  if (!isMonotonicMs(coinEvents, durationMs)) {
    return { ok: false, reason: "invalid_coin_events" };
  }
  if (!isMonotonicMs(nearMissEvents, durationMs)) {
    return { ok: false, reason: "invalid_near_events" };
  }
  if (!isMonotonicMs(flapEvents, durationMs)) {
    return { ok: false, reason: "invalid_flap_events" };
  }

  if (flapEvents.length !== flaps) {
    return { ok: false, reason: "flap_mismatch" };
  }
  if (nearMissEvents.length !== nearMisses) {
    return { ok: false, reason: "near_miss_mismatch" };
  }

  const passCount = passEvents.length;
  const directCoinCount = coinEvents.length;
  const expectedScore = passCount + nearMisses;
  const expectedCoins = directCoinCount + nearMisses;

  if (score !== expectedScore) {
    return { ok: false, reason: "score_mismatch" };
  }
  if (coins !== expectedCoins) {
    return { ok: false, reason: "coin_mismatch" };
  }
  if (nearMisses > passCount) {
    return { ok: false, reason: "near_miss_overflow" };
  }
  if (directCoinCount > passCount) {
    return { ok: false, reason: "coin_overflow" };
  }

  const conservativeMaxPasses = Math.floor(Math.max(0, durationMs - 2_200) / 820) + 2;
  if (passCount > conservativeMaxPasses) {
    return { ok: false, reason: "pass_rate_violation" };
  }

  return {
    ok: true,
    clean: {
      durationMs,
      score,
      coins,
      nearMisses,
      flaps,
      passEvents,
      coinEvents,
      nearMissEvents,
      flapEvents
    }
  };
};

export const verifyAndConsumeSession = async (
  deviceIdRaw: unknown,
  payloadRaw: unknown
): Promise<{ ok: true; deviceId: string; session: StoredSession } | { ok: false; reason: string }> => {
  const deviceId = sanitizeDeviceId(deviceIdRaw);
  if (!deviceId) {
    return { ok: false, reason: "invalid_device_id" };
  }

  if (!payloadRaw || typeof payloadRaw !== "object") {
    return { ok: false, reason: "invalid_session" };
  }

  const payload = payloadRaw as Record<string, unknown>;
  const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : "";
  const seed = Number(payload.seed);
  const issuedAt = Number(payload.issuedAt);
  const expiresAt = Number(payload.expiresAt);
  const nonce = typeof payload.nonce === "string" ? payload.nonce : "";
  const signature = typeof payload.signature === "string" ? payload.signature : "";

  if (!sessionId || !Number.isInteger(seed) || !Number.isInteger(issuedAt) || !Number.isInteger(expiresAt) || !nonce || !signature) {
    return { ok: false, reason: "invalid_session" };
  }

  const now = Date.now();
  if (expiresAt <= now) {
    return { ok: false, reason: "session_expired" };
  }

  const expected = signSession({ sessionId, seed, issuedAt, expiresAt, nonce }, deviceId);
  if (signature !== expected) {
    return { ok: false, reason: "invalid_signature" };
  }

  const stored = await kv.get<StoredSession>(sessionKey(sessionId));
  if (!stored) {
    return { ok: false, reason: "session_missing" };
  }

  if (stored.deviceId !== deviceId || stored.nonce !== nonce || stored.seed !== seed) {
    return { ok: false, reason: "session_binding_failed" };
  }

  const used = await kv.get<number>(usedKey(sessionId));
  if (used) {
    return { ok: false, reason: "session_reused" };
  }

  await kv.set(usedKey(sessionId), 1, { ex: 10 * 60 });
  await kv.del(sessionKey(sessionId));

  return { ok: true, deviceId, session: stored };
};

export const upsertLeaderboard = async (deviceId: string, score: number): Promise<{ rank: number; bestScore: number }> => {
  const current = await kv.zscore<number>(SCOREBOARD_KEY, deviceId);
  const bestScore = Math.max(current ?? 0, score);

  if (bestScore > (current ?? 0)) {
    await kv.zadd(SCOREBOARD_KEY, { score: bestScore, member: deviceId });
  }

  await kv.set(profileKey(deviceId), { player: safePlayerName(deviceId), updatedAt: Date.now() }, { ex: 30 * 24 * 60 * 60 });
  const rank = await kv.zrevrank(SCOREBOARD_KEY, deviceId);

  return {
    rank: typeof rank === "number" ? rank + 1 : 0,
    bestScore
  };
};

export const getTopScores = async (limit: number): Promise<Array<{ rank: number; player: string; score: number }>> => {
  const safeLimit = Math.max(1, Math.min(20, Math.floor(limit)));
  const membersRaw = await kv.zrevrange(SCOREBOARD_KEY, 0, safeLimit - 1);
  const members = Array.isArray(membersRaw) ? membersRaw.filter((item): item is string => typeof item === "string") : [];

  const entries: Array<{ rank: number; player: string; score: number }> = [];
  for (let i = 0; i < members.length; i += 1) {
    const member = members[i];
    const score = await kv.zscore<number>(SCOREBOARD_KEY, member);
    const profile = await kv.get<{ player?: string }>(profileKey(member));
    entries.push({
      rank: i + 1,
      player: profile?.player ?? safePlayerName(member),
      score: score ?? 0
    });
  }

  return entries;
};
