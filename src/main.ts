import Phaser from "phaser";
import { inject } from "@vercel/analytics";
import { injectSpeedInsights } from "@vercel/speed-insights";
import "./styles.css";
import { gameConfig } from "./game/GameConfig";

if (import.meta.env.PROD) {
  inject();
  injectSpeedInsights();
}

void new Phaser.Game(gameConfig);
