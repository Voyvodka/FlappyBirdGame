export type GamePhase = "ready" | "playing" | "dead" | "results";

export type PipeVariant = "static" | "sway" | "pulse";

export interface SkinDefinition {
  id: string;
  name: string;
  tint: number;
  unlockScore: number;
}

export interface SaveData {
  bestScore: number;
  coins: number;
  totalRuns: number;
  totalScore: number;
  unlockedSkins: string[];
  selectedSkin: string;
  achievements: string[];
  localLeaderboard: number[];
}

export interface RunSummary {
  score: number;
  coinsCollected: number;
  nearMisses: number;
  duration: number;
}

export interface DifficultyState {
  intensity: number;
  speed: number;
  pipeGap: number;
  spawnDelay: number;
  swayChance: number;
  pulseChance: number;
  coinChance: number;
  windChance: number;
}
