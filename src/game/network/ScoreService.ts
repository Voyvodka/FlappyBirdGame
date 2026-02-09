const DEVICE_ID_KEY = "ultra_flappy_device_id_v1";

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
  player: string;
}

const createDeviceId = (): string => {
  const randomPart = Math.random().toString(36).slice(2, 10);
  const timePart = Date.now().toString(36);
  return `pilot-${timePart}-${randomPart}`;
};

const getDeviceId = (): string => {
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }

  const generated = createDeviceId();
  localStorage.setItem(DEVICE_ID_KEY, generated);
  return generated;
};

const postJson = async <T>(url: string, payload: unknown): Promise<T> => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
};

export class ScoreService {
  public static async createSession(): Promise<ScoreSession | null> {
    try {
      const body = await postJson<{ session: ScoreSession }>("/api/score/session", {
        deviceId: getDeviceId()
      });
      return body.session;
    } catch {
      return null;
    }
  }

  public static async submitRun(session: ScoreSession, telemetry: RunTelemetry): Promise<SubmitRunResult> {
    try {
      return await postJson<SubmitRunResult>("/api/score/submit", {
        deviceId: getDeviceId(),
        session,
        telemetry
      });
    } catch {
      return {
        accepted: false,
        reason: "network_error"
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
