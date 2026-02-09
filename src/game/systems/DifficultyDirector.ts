import Phaser from "phaser";
import type { DifficultyState } from "../types";

export class DifficultyDirector {
  private elapsedSeconds = 0;

  public reset(): void {
    this.elapsedSeconds = 0;
  }

  public update(deltaMs: number, score: number): DifficultyState {
    this.elapsedSeconds += deltaMs / 1000;

    const scoreFactor = Phaser.Math.Clamp(score / 90, 0, 1);
    const timeFactor = Phaser.Math.Clamp(this.elapsedSeconds / 150, 0, 1);
    const intensity = Phaser.Math.Clamp(scoreFactor * 0.68 + timeFactor * 0.32, 0, 1);

    return {
      intensity,
      speed: Phaser.Math.Linear(210, 410, intensity),
      pipeGap: Math.round(Phaser.Math.Linear(242, 136, intensity)),
      spawnDelay: Math.round(Phaser.Math.Linear(1650, 910, intensity)),
      swayChance: Phaser.Math.Linear(0.16, 0.45, intensity),
      pulseChance: Phaser.Math.Linear(0.07, 0.28, intensity),
      coinChance: Phaser.Math.Linear(0.46, 0.58, intensity),
      windChance: Phaser.Math.Linear(0.05, 0.34, intensity)
    };
  }
}
