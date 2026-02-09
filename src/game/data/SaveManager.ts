import { ACHIEVEMENTS, SKINS, STORAGE_KEY } from "../constants";
import type { RunSummary, SaveData, SkinDefinition } from "../types";

const DEFAULT_SAVE: SaveData = {
  bestScore: 0,
  coins: 0,
  totalRuns: 0,
  totalScore: 0,
  unlockedSkins: ["sunrise"],
  selectedSkin: "sunrise",
  achievements: [],
  localLeaderboard: []
};

const clampLeaderboard = (scores: number[]): number[] => {
  return [...scores]
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((a, b) => b - a)
    .slice(0, 10);
};

const mergeSave = (data: Partial<SaveData>): SaveData => {
  const merged: SaveData = {
    ...DEFAULT_SAVE,
    ...data,
    unlockedSkins: Array.isArray(data.unlockedSkins) ? [...new Set(data.unlockedSkins)] : [...DEFAULT_SAVE.unlockedSkins],
    achievements: Array.isArray(data.achievements) ? [...new Set(data.achievements)] : [],
    localLeaderboard: clampLeaderboard(Array.isArray(data.localLeaderboard) ? data.localLeaderboard : [])
  };

  const selectedExists = merged.unlockedSkins.includes(merged.selectedSkin);
  if (!selectedExists) {
    merged.selectedSkin = merged.unlockedSkins[0] ?? DEFAULT_SAVE.selectedSkin;
  }

  return merged;
};

export class SaveManager {
  public static load(): SaveData {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_SAVE };
    }

    try {
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      return mergeSave(parsed);
    } catch {
      return { ...DEFAULT_SAVE };
    }
  }

  public static save(data: SaveData): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mergeSave(data)));
  }

  public static ensureScoreBasedUnlocks(data: SaveData): { updated: SaveData; unlocked: SkinDefinition[] } {
    const updated = mergeSave(data);
    const unlocked: SkinDefinition[] = [];

    for (const skin of SKINS) {
      if (updated.bestScore >= skin.unlockScore && !updated.unlockedSkins.includes(skin.id)) {
        updated.unlockedSkins.push(skin.id);
        unlocked.push(skin);
      }
    }

    if (unlocked.length > 0) {
      this.save(updated);
    }

    return { updated, unlocked };
  }

  public static registerRun(
    sourceData: SaveData,
    summary: RunSummary
  ): {
    updated: SaveData;
    newBest: boolean;
    unlockedSkins: SkinDefinition[];
    unlockedAchievements: string[];
  } {
    const updated = mergeSave(sourceData);

    updated.totalRuns += 1;
    updated.totalScore += summary.score;
    updated.coins += summary.coinsCollected;
    updated.localLeaderboard = clampLeaderboard([...updated.localLeaderboard, summary.score]);

    let newBest = false;
    if (summary.score > updated.bestScore) {
      updated.bestScore = summary.score;
      newBest = true;
    }

    const unlockedSkins: SkinDefinition[] = [];
    for (const skin of SKINS) {
      if (updated.bestScore >= skin.unlockScore && !updated.unlockedSkins.includes(skin.id)) {
        updated.unlockedSkins.push(skin.id);
        unlockedSkins.push(skin);
      }
    }

    const unlockedAchievements: string[] = [];
    for (const [key, achievement] of Object.entries(ACHIEVEMENTS)) {
      if (!updated.achievements.includes(key) && achievement.check(summary.score, summary.coinsCollected, summary.nearMisses)) {
        updated.achievements.push(key);
        unlockedAchievements.push(achievement.label);
      }
    }

    this.save(updated);

    return {
      updated,
      newBest,
      unlockedSkins,
      unlockedAchievements
    };
  }
}
