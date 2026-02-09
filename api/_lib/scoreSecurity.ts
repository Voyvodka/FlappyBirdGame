import { createHmac, randomUUID } from "crypto";
import { kv } from "@vercel/kv";
import { createClient } from "redis";

const SCOREBOARD_KEY = "scoreboard:global:v2:list";
const SESSION_PREFIX = "score:session:v2:";
const USED_PREFIX = "score:used:v2:";
const RATE_PREFIX = "score:rl:v2:";

const MIN_SESSION_MS = 15_000;
const MAX_SESSION_MS = 6 * 60_000;
const MAX_ENTRIES = 2000;

const KV_REST_URL = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const KV_REST_TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const REDIS_URL = process.env.REDIS_URL ?? process.env.flappybirdgame_REDIS_URL;
const HAS_KV_REST = Boolean(KV_REST_URL && KV_REST_TOKEN);

let redisClientPromise: Promise<any> | null = null;

const getRedisClient = async (): Promise<any> => {
  if (!REDIS_URL) {
    throw new Error("missing_redis_url");
  }
  if (!redisClientPromise) {
    const client = createClient({ url: REDIS_URL });
    redisClientPromise = client.connect().then(() => client);
  }
  return redisClientPromise;
};

const db = {
  async incr(key: string): Promise<number> {
    if (HAS_KV_REST) {
      return kv.incr(key);
    }
    const client = await getRedisClient();
    return client.incr(key);
  },

  async expire(key: string, seconds: number): Promise<void> {
    if (HAS_KV_REST) {
      await kv.expire(key, seconds);
      return;
    }
    const client = await getRedisClient();
    await client.expire(key, seconds);
  },

  async set(key: string, value: unknown, seconds?: number): Promise<void> {
    if (HAS_KV_REST) {
      if (seconds) {
        await kv.set(key, value, { ex: seconds });
      } else {
        await kv.set(key, value);
      }
      return;
    }
    const client = await getRedisClient();
    const payload = JSON.stringify(value);
    if (seconds) {
      await client.set(key, payload, { EX: seconds });
    } else {
      await client.set(key, payload);
    }
  },

  async get<T>(key: string): Promise<T | null> {
    if (HAS_KV_REST) {
      return kv.get<T>(key);
    }
    const client = await getRedisClient();
    const raw = await client.get(key);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as T;
    }
  },

  async del(key: string): Promise<void> {
    if (HAS_KV_REST) {
      await kv.del(key);
      return;
    }
    const client = await getRedisClient();
    await client.del(key);
  },

  async lpush(key: string, value: string): Promise<void> {
    if (HAS_KV_REST) {
      await kv.lpush(key, value);
      return;
    }
    const client = await getRedisClient();
    await client.lPush(key, value);
  },

  async ltrim(key: string, start: number, stop: number): Promise<void> {
    if (HAS_KV_REST) {
      await kv.ltrim(key, start, stop);
      return;
    }
    const client = await getRedisClient();
    await client.lTrim(key, start, stop);
  },

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    if (HAS_KV_REST) {
      const raw = await kv.lrange(key, start, stop);
      return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string") : [];
    }
    const client = await getRedisClient();
    return client.lRange(key, start, stop);
  }
};

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
  username: string;
  seed: number;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
}

interface LeaderboardRecord {
  username: string;
  score: number;
}

const sanitizeUsername = (input: unknown): string | null => {
  if (typeof input !== "string") {
    return null;
  }
  const clean = input.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 16);
  if (clean.length < 3) {
    return null;
  }
  return clean;
};

const getSecret = (): string => {
  const secret = process.env.SCORE_SIGNING_SECRET;
  if (!secret) {
    throw new Error("missing_signing_secret");
  }
  return secret;
};

const signSession = (session: Omit<ScoreSessionPayload, "signature">, username: string): string => {
  const base = [session.sessionId, username, session.seed, session.issuedAt, session.expiresAt, session.nonce].join("|");
  return createHmac("sha256", getSecret()).update(base).digest("hex");
};

const sessionKey = (sessionId: string): string => `${SESSION_PREFIX}${sessionId}`;
const usedKey = (sessionId: string): string => `${USED_PREFIX}${sessionId}`;

const parseRecord = (raw: string): LeaderboardRecord | null => {
  try {
    const parsed = JSON.parse(raw) as Partial<LeaderboardRecord>;
    const username = sanitizeUsername(parsed.username);
    const score = Number(parsed.score);
    if (!username || !Number.isInteger(score) || score < 0 || score > 10_000) {
      return null;
    }
    return { username, score };
  } catch {
    return null;
  }
};

const buildSorted = (records: LeaderboardRecord[]): LeaderboardRecord[] => {
  return [...records].sort((a, b) => b.score - a.score);
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
  const count = await db.incr(redisKey);
  if (count === 1) {
    await db.expire(redisKey, 70);
  }
  return count <= maxPerMinute;
};

export const createSession = async (usernameRaw: unknown): Promise<{ session: ScoreSessionPayload; username: string }> => {
  const username = sanitizeUsername(usernameRaw);
  if (!username) {
    throw new Error("invalid_username");
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

  const signature = signSession(session, username);
  const stored: StoredSession = {
    sessionId: session.sessionId,
    username,
    seed: session.seed,
    issuedAt,
    expiresAt,
    nonce: session.nonce
  };

  await db.set(sessionKey(session.sessionId), stored, 5 * 60);

  return {
    username,
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
  if (!Array.isArray(events) || events.length > 1500) {
    return false;
  }

  let prev = -1;
  for (const value of events) {
    if (!Number.isInteger(value) || value < 0 || value > durationMs || value < prev) {
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
  usernameRaw: unknown,
  payloadRaw: unknown
): Promise<{ ok: true; username: string; session: StoredSession } | { ok: false; reason: string }> => {
  const username = sanitizeUsername(usernameRaw);
  if (!username) {
    return { ok: false, reason: "invalid_username" };
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

  if (expiresAt <= Date.now()) {
    return { ok: false, reason: "session_expired" };
  }

  const expected = signSession({ sessionId, seed, issuedAt, expiresAt, nonce }, username);
  if (signature !== expected) {
    return { ok: false, reason: "invalid_signature" };
  }

  const stored = await db.get<StoredSession>(sessionKey(sessionId));
  if (!stored) {
    return { ok: false, reason: "session_missing" };
  }
  if (stored.username !== username || stored.nonce !== nonce || stored.seed !== seed) {
    return { ok: false, reason: "session_binding_failed" };
  }

  const used = await db.get<number>(usedKey(sessionId));
  if (used) {
    return { ok: false, reason: "session_reused" };
  }

  await db.set(usedKey(sessionId), 1, 10 * 60);
  await db.del(sessionKey(sessionId));

  return { ok: true, username, session: stored };
};

export const upsertLeaderboard = async (username: string, score: number): Promise<{ rank: number; bestScore: number }> => {
  await db.lpush(SCOREBOARD_KEY, JSON.stringify({ username, score }));
  await db.ltrim(SCOREBOARD_KEY, 0, MAX_ENTRIES - 1);

  const rows = await db.lrange(SCOREBOARD_KEY, 0, MAX_ENTRIES - 1);
  const records = rows.map(parseRecord).filter((item): item is LeaderboardRecord => Boolean(item));
  const sorted = buildSorted(records);

  const rankIndex = sorted.findIndex((entry) => entry.username === username && entry.score === score);
  const rank = rankIndex >= 0 ? rankIndex + 1 : 0;

  let bestScore = 0;
  for (const entry of sorted) {
    if (entry.username === username && entry.score > bestScore) {
      bestScore = entry.score;
    }
  }

  return {
    rank,
    bestScore
  };
};

export const getTopScores = async (limit: number): Promise<Array<{ rank: number; username: string; score: number }>> => {
  const safeLimit = Math.max(1, Math.min(20, Math.floor(limit)));
  const rows = await db.lrange(SCOREBOARD_KEY, 0, MAX_ENTRIES - 1);
  const records = rows.map(parseRecord).filter((item): item is LeaderboardRecord => Boolean(item));
  const sorted = buildSorted(records).slice(0, safeLimit);

  return sorted.map((entry, index) => ({
    rank: index + 1,
    username: entry.username,
    score: entry.score
  }));
};
