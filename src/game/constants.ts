import type { SkinDefinition } from "./types";

export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 854;

export const STORAGE_KEY = "ultra_flappy_save_v1";

export const PIPE_BODY_WIDTH = 96;
export const PIPE_BODY_HEIGHT = 520;

export const GROUND_HEIGHT = 104;
export const DEFAULT_FLAP_POWER = 430;
export const BIRD_GRAVITY = 1650;

export const SKINS: SkinDefinition[] = [
  {
    id: "sunrise",
    name: "Sunrise Runner",
    tint: 0xf7b733,
    unlockScore: 0
  },
  {
    id: "mint",
    name: "Mint Drift",
    tint: 0x34d399,
    unlockScore: 25
  },
  {
    id: "ember",
    name: "Ember Core",
    tint: 0xf97316,
    unlockScore: 55
  },
  {
    id: "arctic",
    name: "Arctic Nova",
    tint: 0x93c5fd,
    unlockScore: 95
  }
];

export const ACHIEVEMENTS: Record<string, { label: string; check: (score: number, coins: number, nearMiss: number) => boolean }> = {
  first_flight: {
    label: "Ilk ucus",
    check: (score) => score >= 1
  },
  score_25: {
    label: "Skor 25",
    check: (score) => score >= 25
  },
  score_60: {
    label: "Skor 60",
    check: (score) => score >= 60
  },
  coin_hunter: {
    label: "Para avcisi",
    check: (_score, coins) => coins >= 12
  },
  edge_master: {
    label: "Kenar ustasi",
    check: (_score, _coins, nearMiss) => nearMiss >= 5
  }
};
