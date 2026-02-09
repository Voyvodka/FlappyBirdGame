const USERNAME_KEY = "ultra_flappy_username_v1";
const DEFAULT_USERNAME = "pilot";

export interface ScoreSession {
  sessionId: string;
  seed: number;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
  signature: string;
}

export interface RunTelemetry {
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

export interface SubmitRunResult {
  accepted: boolean;
  reason?: string;
  rank?: number;
  bestScore?: number;
}

export interface GlobalScoreEntry {
  rank: number;
  score: number;
  username: string;
}

const sanitizeUsername = (raw: string): string => {
  const clean = raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const bounded = clean.slice(0, 16);
  return bounded.length >= 3 ? bounded : DEFAULT_USERNAME;
};

const getStoredUsername = (): string => {
  const existing = localStorage.getItem(USERNAME_KEY);
  if (existing && existing.trim().length > 0) {
    return sanitizeUsername(existing);
  }
  return DEFAULT_USERNAME;
};

const postJson = async <T>(url: string, payload: unknown): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  } catch {
    throw new Error("network_error");
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const parsed = body as { reason?: string; error?: string } | null;
    throw new Error(parsed?.reason ?? parsed?.error ?? `http_${response.status}`);
  }

  return body as T;
};

export class ScoreService {
  public static getUsername(): string {
    return getStoredUsername();
  }

  public static setUsername(raw: string): string {
    const username = sanitizeUsername(raw);
    localStorage.setItem(USERNAME_KEY, username);
    return username;
  }

  public static async createSession(username: string): Promise<ScoreSession | null> {
    try {
      const body = await postJson<{ session: ScoreSession }>("/api/score/session", {
        username: sanitizeUsername(username)
      });
      return body.session;
    } catch {
      return null;
    }
  }

  public static async submitRun(username: string, session: ScoreSession, telemetry: RunTelemetry): Promise<SubmitRunResult> {
    try {
      return await postJson<SubmitRunResult>("/api/score/submit", {
        username: sanitizeUsername(username),
        session,
        telemetry
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "network_error";
      return {
        accepted: false,
        reason
      };
    }
  }

  public static async fetchTop(limit = 5): Promise<GlobalScoreEntry[]> {
    try {
      const response = await fetch(`/api/score/top?limit=${limit}`);
      if (!response.ok) {
        return [];
      }
      const body = (await response.json()) as { entries?: GlobalScoreEntry[] };
      return Array.isArray(body.entries) ? body.entries : [];
    } catch {
      return [];
    }
  }
}
