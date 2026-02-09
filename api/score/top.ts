import { getTopScores } from "../_lib/scoreSecurity.js";

export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const rawLimit = typeof req.query?.limit === "string" ? Number(req.query.limit) : 5;
  const limit = Number.isFinite(rawLimit) ? rawLimit : 5;

  try {
    const entries = await getTopScores(limit);
    res.status(200).json({ entries });
  } catch {
    res.status(500).json({ entries: [] });
  }
}
