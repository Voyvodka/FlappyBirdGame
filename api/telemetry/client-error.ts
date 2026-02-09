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

const toSafeText = (value: unknown, max = 200): string => {
  if (typeof value !== "string") {
    return "";
  }
  return value.slice(0, max);
};

export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, reason: "method_not_allowed" });
    return;
  }

  try {
    const json = readJson(req.body);
    const source = toSafeText(json.source, 80);
    const message = toSafeText(json.message, 240);
    const path = toSafeText(json.path, 120);
    const ua = toSafeText(json.ua, 220);

    console.warn("[client-bootstrap-issue]", {
      source,
      message,
      path,
      ua
    });

    res.status(200).json({ ok: true });
  } catch {
    res.status(200).json({ ok: true });
  }
}
