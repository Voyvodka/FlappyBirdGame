import Phaser from "phaser";
import { ProceduralAssets } from "../systems/ProceduralAssets";

export class BootScene extends Phaser.Scene {
  public constructor() {
    super("BootScene");
  }

  public create(): void {
    this.cameras.main.setBackgroundColor("#111827");
    ProceduralAssets.create(this);
    this.scene.start("MenuScene");
  }
}
