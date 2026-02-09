import Phaser from "phaser";
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  GROUND_HEIGHT,
  PIPE_BODY_HEIGHT,
  PIPE_BODY_WIDTH,
  SKINS
} from "../constants";
import { SaveManager } from "../data/SaveManager";
import { Bird } from "../entities/Bird";
import { ScoreService, type ScoreSession } from "../network/ScoreService";
import { AudioSystem } from "../systems/AudioSystem";
import { DifficultyDirector } from "../systems/DifficultyDirector";
import type { DifficultyState, GamePhase, PipeVariant, SaveData, SkinDefinition } from "../types";

interface PipePair {
  x: number;
  gapCenter: number;
  gapSize: number;
  currentCenter: number;
  currentGap: number;
  variant: PipeVariant;
  amplitude: number;
  frequency: number;
  phase: number;
  scored: boolean;
  top: Phaser.GameObjects.Image;
  bottom: Phaser.GameObjects.Image;
  topCap: Phaser.GameObjects.Image;
  bottomCap: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  coin?: Phaser.GameObjects.Image;
}

interface ActiveWind {
  remainingMs: number;
  force: number;
  label: string;
}

const DEFAULT_DIFFICULTY: DifficultyState = {
  intensity: 0,
  speed: 220,
  pipeGap: 240,
  spawnDelay: 1600,
  swayChance: 0.16,
  pulseChance: 0.08,
  coinChance: 0.46,
  windChance: 0.05
};

export class PlayScene extends Phaser.Scene {
  private sky!: Phaser.GameObjects.TileSprite;
  private clouds!: Phaser.GameObjects.TileSprite;
  private mountains!: Phaser.GameObjects.TileSprite;
  private city!: Phaser.GameObjects.TileSprite;
  private foreground!: Phaser.GameObjects.TileSprite;
  private ground!: Phaser.GameObjects.TileSprite;
  private windLayer!: Phaser.GameObjects.TileSprite;

  private saveData!: SaveData;
  private selectedSkin!: SkinDefinition;

  private audioSystem!: AudioSystem;
  private difficultyDirector = new DifficultyDirector();
  private activeDifficulty = DEFAULT_DIFFICULTY;

  private bird!: Bird;

  private phase: GamePhase = "ready";
  private score = 0;
  private coinsRun = 0;
  private nearMisses = 0;
  private elapsedSeconds = 0;
  private runStartedAtMs = 0;

  private scoreSession: ScoreSession | null = null;
  private username = "pilot";
  private flapEvents: number[] = [];
  private passEvents: number[] = [];
  private coinEvents: number[] = [];
  private nearMissEvents: number[] = [];
  private remoteResultText = "";

  private pipes: PipePair[] = [];
  private spawnCooldownMs = 500;

  private trailCooldownMs = 0;
  private windTickMs = 6800;
  private activeWind: ActiveWind | null = null;

  private groundY = GAME_HEIGHT - GROUND_HEIGHT;

  private scoreLabel!: Phaser.GameObjects.Text;
  private coinLabel!: Phaser.GameObjects.Text;
  private stateLabel!: Phaser.GameObjects.Text;
  private windLabel!: Phaser.GameObjects.Text;

  private overlay!: Phaser.GameObjects.Container;
  private resultTitle!: Phaser.GameObjects.Text;
  private resultStats!: Phaser.GameObjects.Text;
  private unlockLabel!: Phaser.GameObjects.Text;

  public constructor() {
    super("PlayScene");
  }

  public create(data: { skinId?: string; username?: string }): void {
    const loaded = SaveManager.ensureScoreBasedUnlocks(SaveManager.load());
    this.saveData = loaded.updated;

    const requestedSkin = SKINS.find((skin) => skin.id === data?.skinId);
    const savedSkin = SKINS.find((skin) => skin.id === this.saveData.selectedSkin);
    const fallback = SKINS[0];
    this.selectedSkin = requestedSkin ?? savedSkin ?? fallback;

    if (!this.saveData.unlockedSkins.includes(this.selectedSkin.id) && this.selectedSkin.unlockScore > this.saveData.bestScore) {
      this.selectedSkin = SKINS.find((skin) => this.saveData.unlockedSkins.includes(skin.id)) ?? fallback;
    }

    this.saveData.selectedSkin = this.selectedSkin.id;
    SaveManager.save(this.saveData);

    this.username = ScoreService.setUsername(data?.username ?? ScoreService.getUsername());

    this.audioSystem = new AudioSystem(this);
    this.difficultyDirector.reset();
    this.activeDifficulty = DEFAULT_DIFFICULTY;
    this.resetRuntimeState();

    this.createBackground();
    this.createBird();
    this.createHud();
    this.createResultOverlay();
    this.bindInput();

    this.cameras.main.fadeIn(250, 0, 0, 0);
  }

  private resetRuntimeState(): void {
    this.phase = "ready";
    this.score = 0;
    this.coinsRun = 0;
    this.nearMisses = 0;
    this.elapsedSeconds = 0;
    this.spawnCooldownMs = 500;
    this.trailCooldownMs = 0;
    this.windTickMs = 6800;
    this.activeWind = null;
    this.pipes = [];
    this.scoreSession = null;
    this.runStartedAtMs = 0;
    this.flapEvents = [];
    this.passEvents = [];
    this.coinEvents = [];
    this.nearMissEvents = [];
    this.remoteResultText = "";
    this.cameras.main.setAngle(0);
  }

  public update(time: number, delta: number): void {
    this.scrollBackground(delta);
    this.bird.updateBird(delta);

    this.cameras.main.setAngle(0);

    if (this.phase === "ready") {
      return;
    }

    if (this.phase === "playing") {
      this.elapsedSeconds += delta / 1000;
      this.activeDifficulty = this.difficultyDirector.update(delta, this.score);

      this.spawnCooldownMs -= delta;
      if (this.spawnCooldownMs <= 0) {
        this.spawnPipePair();
        this.spawnCooldownMs += this.activeDifficulty.spawnDelay;
      }

      this.updateWind(delta);
      this.updatePipes(time, delta);
      this.updateTrail(delta);

      if (this.checkCollisions()) {
        this.triggerCrash();
      }
    }

    if (this.phase === "dead") {
      this.updatePipes(time, delta * 0.5);
      this.updateTrail(delta);
    }
  }

  private createBackground(): void {
    this.sky = this.add.tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, "bg-sky").setDepth(0);
    this.clouds = this.add
      .tileSprite(GAME_WIDTH / 2, GAME_HEIGHT * 0.22, GAME_WIDTH, 220, "bg-clouds")
      .setAlpha(0.86)
      .setDepth(2);
    this.mountains = this.add
      .tileSprite(GAME_WIDTH / 2, GAME_HEIGHT * 0.55, GAME_WIDTH, 220, "bg-mountains")
      .setDepth(3)
      .setAlpha(0.75);
    this.city = this.add.tileSprite(GAME_WIDTH / 2, GAME_HEIGHT * 0.68, GAME_WIDTH, 260, "bg-city").setDepth(4);
    this.foreground = this.add
      .tileSprite(GAME_WIDTH / 2, GAME_HEIGHT - 135, GAME_WIDTH, 210, "bg-foreground")
      .setDepth(5)
      .setAlpha(0.9);

    this.ground = this.add
      .tileSprite(GAME_WIDTH / 2, GAME_HEIGHT - GROUND_HEIGHT / 2, GAME_WIDTH, GROUND_HEIGHT, "bg-ground")
      .setDepth(12);

    this.windLayer = this.add
      .tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, "wind-layer")
      .setDepth(50)
      .setAlpha(0)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0f172a, 0.09).setDepth(6);
  }

  private createBird(): void {
    this.bird = new Bird(this, GAME_WIDTH * 0.3, GAME_HEIGHT * 0.46);
    this.bird.applySkin(this.selectedSkin.tint);
    this.bird.setGameplayGravity(false);

    this.tweens.add({
      targets: this.bird,
      y: this.bird.y + 16,
      duration: 850,
      yoyo: true,
      repeat: -1,
      ease: "sine.inOut"
    });
  }

  private createHud(): void {
    this.scoreLabel = this.add
      .text(GAME_WIDTH / 2, 92, "0", {
        fontFamily: "Changa",
        fontSize: "68px",
        color: "#fffaf0",
        stroke: "#4a2b1a",
        strokeThickness: 10
      })
      .setOrigin(0.5)
      .setDepth(70);

    this.coinLabel = this.add
      .text(18, 26, "COINS 0", {
        fontFamily: "Outfit",
        fontSize: "24px",
        color: "#fff7d8",
        stroke: "#3f2b1b",
        strokeThickness: 4,
        fontStyle: "700"
      })
      .setOrigin(0, 0)
      .setDepth(70);

    this.stateLabel = this.add
      .text(GAME_WIDTH / 2, 176, "Tap or SPACE to launch", {
        fontFamily: "Outfit",
        fontSize: "26px",
        color: "#fff2cc",
        stroke: "#3f2b1b",
        strokeThickness: 4
      })
      .setOrigin(0.5)
      .setDepth(70);

    this.windLabel = this.add
      .text(GAME_WIDTH / 2, 236, "", {
        fontFamily: "Outfit",
        fontSize: "23px",
        color: "#dbeafe",
        stroke: "#1e3a8a",
        strokeThickness: 5,
        fontStyle: "700"
      })
      .setOrigin(0.5)
      .setDepth(75)
      .setAlpha(0);
  }

  private createResultOverlay(): void {
    const dim = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020617, 0.66)
      .setInteractive();

    const panel = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "ui-panel").setScale(0.86, 1.24);

    this.resultTitle = this.add
      .text(GAME_WIDTH / 2, 280, "RUN COMPLETE", {
        fontFamily: "Changa",
        fontSize: "42px",
        color: "#8b4513",
        stroke: "#fdf7eb",
        strokeThickness: 4
      })
      .setOrigin(0.5);

    this.resultStats = this.add
      .text(GAME_WIDTH / 2, 372, "", {
        fontFamily: "Outfit",
        fontSize: "28px",
        color: "#1f2937",
        align: "center",
        lineSpacing: 8
      })
      .setOrigin(0.5);

    this.unlockLabel = this.add
      .text(GAME_WIDTH / 2, 498, "", {
        fontFamily: "Outfit",
        fontSize: "20px",
        color: "#9f1239",
        align: "center"
      })
      .setOrigin(0.5)
      .setAlpha(0);

    const replayButton = this.createOverlayButton(GAME_WIDTH / 2, 558, "PLAY AGAIN", () => {
      this.scene.restart({ skinId: this.selectedSkin.id });
    });

    const menuButton = this.createOverlayButton(GAME_WIDTH / 2, 638, "MAIN MENU", () => {
      this.scene.start("MenuScene");
    });

    this.overlay = this.add.container(0, 0, [dim, panel, this.resultTitle, this.resultStats, this.unlockLabel, replayButton, menuButton]);
    this.overlay.setDepth(140);
    this.overlay.setVisible(false);
    this.overlay.setAlpha(0);
  }

  private createOverlayButton(
    x: number,
    y: number,
    label: string,
    callback: () => void
  ): Phaser.GameObjects.Container {
    const button = this.add.image(x, y, "ui-button").setScale(0.86).setInteractive({ useHandCursor: true });
    const text = this.add
      .text(x, y, label, {
        fontFamily: "Changa",
        fontSize: "28px",
        color: "#fff7e6",
        stroke: "#6c2d11",
        strokeThickness: 5
      })
      .setOrigin(0.5);

    button.on("pointerover", () => {
      button.setScale(0.9);
      text.setScale(1.04);
    });

    button.on("pointerout", () => {
      button.setScale(0.86);
      text.setScale(1);
    });

    button.on("pointerdown", () => {
      button.setTint(0xfff1c2);
      this.time.delayedCall(80, () => button.clearTint());
      callback();
    });

    return this.add.container(0, 0, [button, text]);
  }

  private bindInput(): void {
    this.input.off("pointerdown", this.onFlapPointerDown, this);
    this.input.on("pointerdown", this.onFlapPointerDown, this);

    this.input.keyboard?.off("keydown-SPACE", this.onFlapKeyDown, this);
    this.input.keyboard?.off("keydown-UP", this.onFlapKeyDown, this);
    this.input.keyboard?.on("keydown-SPACE", this.onFlapKeyDown, this);
    this.input.keyboard?.on("keydown-UP", this.onFlapKeyDown, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off("pointerdown", this.onFlapPointerDown, this);
      this.input.keyboard?.off("keydown-SPACE", this.onFlapKeyDown, this);
      this.input.keyboard?.off("keydown-UP", this.onFlapKeyDown, this);
    });
  }

  private onFlapPointerDown(): void {
    this.handleFlapInput();
  }

  private onFlapKeyDown(): void {
    this.handleFlapInput();
  }

  private handleFlapInput(): void {
    if (this.phase === "ready") {
      this.startRun();
    }

    if (this.phase !== "playing") {
      return;
    }

    this.bird.flap();
    this.audioSystem.flap();
    this.flapEvents.push(this.getRunElapsedMs());
  }

  private startRun(): void {
    this.phase = "playing";
    this.bird.revive();
    this.bird.setGameplayGravity(true);
    this.bird.flap();

    this.audioSystem.flap();
    this.stateLabel.setAlpha(0);

    this.tweens.killTweensOf(this.bird);

    this.spawnCooldownMs = 450;
    this.windTickMs = Phaser.Math.Between(5000, 8000);
    this.score = 0;
    this.coinsRun = 0;
    this.nearMisses = 0;
    this.elapsedSeconds = 0;
    this.pipes = [];
    this.activeWind = null;
    this.runStartedAtMs = this.time.now;
    this.flapEvents = [0];
    this.passEvents = [];
    this.coinEvents = [];
    this.nearMissEvents = [];
    this.remoteResultText = "";

    void this.openRemoteScoreSession();
  }

  private scrollBackground(delta: number): void {
    const speedFactor = this.phase === "playing" ? this.activeDifficulty.speed / 230 : 0.65;

    this.sky.tilePositionX += 0.012 * delta * speedFactor;
    this.clouds.tilePositionX += 0.03 * delta * speedFactor;
    this.mountains.tilePositionX += 0.05 * delta * speedFactor;
    this.city.tilePositionX += 0.09 * delta * speedFactor;
    this.foreground.tilePositionX += 0.13 * delta * speedFactor;
    this.ground.tilePositionX += 0.2 * delta * speedFactor;
  }

  private spawnPipePair(): void {
    const x = GAME_WIDTH + 140;
    const topMargin = 120;
    const bottomMargin = this.groundY - 120;

    const gapCenter = Phaser.Math.Between(topMargin, bottomMargin);
    const baseGap = Phaser.Math.Clamp(this.activeDifficulty.pipeGap + Phaser.Math.Between(-14, 18), 126, 280);
    const variant = this.pickVariant();

    const top = this.add.image(x, 0, "pipe-body").setOrigin(0.5, 1).setDepth(26);
    const bottom = this.add.image(x, 0, "pipe-body").setOrigin(0.5, 0).setFlipY(true).setDepth(26);
    const topCap = this.add.image(x, 0, "pipe-cap").setOrigin(0.5, 1).setDepth(27);
    const bottomCap = this.add.image(x, 0, "pipe-cap").setOrigin(0.5, 0).setFlipY(true).setDepth(27);
    const glow = this.add.image(x, gapCenter, "pipe-glow").setDepth(24).setAlpha(0.14).setBlendMode(Phaser.BlendModes.ADD);

    let coin: Phaser.GameObjects.Image | undefined;
    if (Math.random() < this.activeDifficulty.coinChance) {
      coin = this.add.image(x, gapCenter, "coin").setDepth(31).setScale(0.58);
    }

    const pair: PipePair = {
      x,
      gapCenter,
      gapSize: baseGap,
      currentCenter: gapCenter,
      currentGap: baseGap,
      variant,
      amplitude: variant === "sway" ? Phaser.Math.Between(20, 44) : Phaser.Math.Between(0, 16),
      frequency: Phaser.Math.FloatBetween(0.7, 1.7),
      phase: Phaser.Math.FloatBetween(0, Math.PI * 2),
      scored: false,
      top,
      bottom,
      topCap,
      bottomCap,
      glow,
      coin
    };

    this.applyPairLayout(pair, this.time.now * 0.001);
    this.pipes.push(pair);
  }

  private pickVariant(): PipeVariant {
    const roll = Math.random();
    if (roll < this.activeDifficulty.pulseChance) {
      return "pulse";
    }
    if (roll < this.activeDifficulty.pulseChance + this.activeDifficulty.swayChance) {
      return "sway";
    }
    return "static";
  }

  private updatePipes(time: number, delta: number): void {
    const deltaSec = delta / 1000;
    const speed = this.activeDifficulty.speed;

    for (let i = this.pipes.length - 1; i >= 0; i -= 1) {
      const pair = this.pipes[i];

      pair.x -= speed * deltaSec;
      this.applyPairLayout(pair, time * 0.001);

      if (!pair.scored && pair.x < this.bird.x - 24) {
        pair.scored = true;
        this.handleScorePass(pair);
      }

      if (pair.coin && this.intersectsCoin(pair.coin, this.bird.getHitbox())) {
        this.coinsRun += 1;
        this.audioSystem.coin();
        this.pulseHud();
        this.showFloatingText(this.bird.x, this.bird.y - 52, "+1 coin", "#fef08a");
        this.coinEvents.push(this.getRunElapsedMs());
        pair.coin.destroy();
        pair.coin = undefined;
        this.refreshHudText();
      }

      if (pair.x < -180) {
        this.destroyPair(pair);
        this.pipes.splice(i, 1);
      }
    }
  }

  private applyPairLayout(pair: PipePair, timeSec: number): void {
    const sway = pair.variant === "sway" ? Math.sin(timeSec * pair.frequency + pair.phase) * pair.amplitude : 0;
    const pulse = pair.variant === "pulse" ? Math.sin(timeSec * pair.frequency + pair.phase) * 24 : 0;

    pair.currentGap = Phaser.Math.Clamp(pair.gapSize + pulse, 120, 300);
    pair.currentCenter = pair.gapCenter + sway;

    const topY = pair.currentCenter - pair.currentGap * 0.5;
    const bottomY = pair.currentCenter + pair.currentGap * 0.5;

    pair.top.setPosition(pair.x, topY);
    pair.bottom.setPosition(pair.x, bottomY);
    pair.topCap.setPosition(pair.x, topY);
    pair.bottomCap.setPosition(pair.x, bottomY);
    pair.glow.setPosition(pair.x, pair.currentCenter);

    if (pair.coin) {
      pair.coin.setPosition(pair.x, pair.currentCenter + sway * 0.25);
      pair.coin.angle += 2.3;
    }
  }

  private handleScorePass(pair: PipePair): void {
    this.score += 1;
    this.audioSystem.score();
    this.passEvents.push(this.getRunElapsedMs());

    const centerDistance = Math.abs(this.bird.y - pair.currentCenter);
    const clearance = pair.currentGap * 0.5 - centerDistance;
    if (clearance < 18) {
      this.nearMisses += 1;
      this.score += 1;
      this.coinsRun += 1;
      this.audioSystem.nearMiss();
      this.showFloatingText(pair.x, pair.currentCenter, "EDGE +1", "#fca5a5");
      this.nearMissEvents.push(this.getRunElapsedMs());
    }

    this.pulseHud();
    this.refreshHudText();
  }

  private refreshHudText(): void {
    this.scoreLabel.setText(String(this.score));
    this.coinLabel.setText(`COINS ${this.coinsRun}`);
  }

  private pulseHud(): void {
    this.tweens.killTweensOf(this.scoreLabel);
    this.scoreLabel.setScale(1);
    this.tweens.add({
      targets: this.scoreLabel,
      scale: 1.12,
      duration: 80,
      yoyo: true,
      ease: "quad.out"
    });
  }

  private updateTrail(delta: number): void {
    this.trailCooldownMs -= delta;
    if (this.trailCooldownMs > 0) {
      return;
    }

    this.trailCooldownMs = this.phase === "dead" ? 85 : 45;

    const glow = this.add
      .image(this.bird.x - 11, this.bird.y + 4, "particle-glow")
      .setDepth(18)
      .setScale(0.43)
      .setTint(this.selectedSkin.tint)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.tweens.add({
      targets: glow,
      x: glow.x - Phaser.Math.Between(8, 18),
      y: glow.y + Phaser.Math.Between(-6, 7),
      alpha: 0,
      scale: 0.08,
      duration: Phaser.Math.Between(260, 360),
      onComplete: () => glow.destroy()
    });
  }

  private updateWind(delta: number): void {
    if (this.activeWind) {
      const wind = this.activeWind;
      wind.remainingMs -= delta;

      this.bird.pushVertical((wind.force * delta) / 1000);

      this.windLayer.tilePositionX += delta * 0.35;
      this.windLayer.alpha = Phaser.Math.Linear(this.windLayer.alpha, 0.2, 0.12);
      this.windLabel.setAlpha(1);
      this.windLabel.setText(wind.label);

      if (wind.remainingMs <= 0) {
        this.activeWind = null;
      }

      return;
    }

    this.windLabel.setAlpha(0);
    this.windLayer.alpha = Phaser.Math.Linear(this.windLayer.alpha, 0, 0.05);

    this.windTickMs -= delta;
    if (this.windTickMs > 0) {
      return;
    }

    this.windTickMs = Phaser.Math.Between(4200, 8400);
    if (Math.random() > this.activeDifficulty.windChance) {
      return;
    }

    const force = Phaser.Math.Between(-390, 390);
    this.activeWind = {
      remainingMs: Phaser.Math.Between(1800, 3200),
      force,
      label: force < 0 ? "UPDRAFT" : "DOWNBURST"
    };

    this.showFloatingText(GAME_WIDTH / 2, 270, this.activeWind.label, "#bfdbfe");
  }

  private checkCollisions(): boolean {
    const birdRect = this.bird.getHitbox();

    if (birdRect.bottom >= this.groundY - 8) {
      return true;
    }

    if (birdRect.top <= 4) {
      return true;
    }

    for (const pair of this.pipes) {
      const topRect = new Phaser.Geom.Rectangle(
        pair.x - PIPE_BODY_WIDTH * 0.5 + 6,
        pair.top.y - PIPE_BODY_HEIGHT + 8,
        PIPE_BODY_WIDTH - 12,
        PIPE_BODY_HEIGHT - 14
      );
      const bottomRect = new Phaser.Geom.Rectangle(
        pair.x - PIPE_BODY_WIDTH * 0.5 + 6,
        pair.bottom.y + 8,
        PIPE_BODY_WIDTH - 12,
        PIPE_BODY_HEIGHT - 14
      );

      if (
        Phaser.Geom.Intersects.RectangleToRectangle(birdRect, topRect) ||
        Phaser.Geom.Intersects.RectangleToRectangle(birdRect, bottomRect)
      ) {
        return true;
      }
    }

    return false;
  }

  private intersectsCoin(coin: Phaser.GameObjects.Image, birdRect: Phaser.Geom.Rectangle): boolean {
    const bounds = coin.getBounds();
    const collectRect = new Phaser.Geom.Rectangle(bounds.x + 12, bounds.y + 12, bounds.width - 24, bounds.height - 24);
    return Phaser.Geom.Intersects.RectangleToRectangle(birdRect, collectRect);
  }

  private triggerCrash(): void {
    if (this.phase !== "playing") {
      return;
    }

    this.phase = "dead";
    this.bird.kill();
    this.audioSystem.hit();
    this.activeWind = null;
    this.windLabel.setAlpha(0);

    this.cameras.main.shake(240, 0.008);
    this.spawnImpactBurst();

    this.time.delayedCall(900, () => {
      this.showResults();
    });
  }

  private spawnImpactBurst(): void {
    for (let i = 0; i < 18; i += 1) {
      const spark = this.add
        .image(this.bird.x, this.bird.y, "particle-spark")
        .setDepth(90)
        .setScale(Phaser.Math.FloatBetween(0.6, 1.15))
        .setTint(i % 2 === 0 ? this.selectedSkin.tint : 0xfef08a)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAngle(Phaser.Math.Between(0, 360));

      const velocity = Phaser.Math.Between(90, 220);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const targetX = spark.x + Math.cos(angle) * velocity;
      const targetY = spark.y + Math.sin(angle) * velocity;

      this.tweens.add({
        targets: spark,
        x: targetX,
        y: targetY,
        alpha: 0,
        scale: 0,
        duration: Phaser.Math.Between(240, 460),
        onComplete: () => spark.destroy()
      });
    }
  }

  private showResults(): void {
    if (this.phase === "results") {
      return;
    }

    this.phase = "results";

    const report = SaveManager.registerRun(this.saveData, {
      score: this.score,
      coinsCollected: this.coinsRun,
      nearMisses: this.nearMisses,
      duration: this.elapsedSeconds
    });

    this.saveData = report.updated;

    this.resultTitle.setText(report.newBest ? "NEW RECORD" : "RUN COMPLETE");

    this.resultStats.setText(
      [`Score  ${this.score}`, `Best   ${this.saveData.bestScore}`, `Coins +${this.coinsRun}`, `Near Miss ${this.nearMisses}`].join(
        "\n"
      )
    );

    const unlockLines: string[] = [];
    if (report.unlockedSkins.length > 0) {
      unlockLines.push(`New skin: ${report.unlockedSkins.map((skin) => skin.name).join(", ")}`);
    }
    if (report.unlockedAchievements.length > 0) {
      unlockLines.push(`Achievement: ${report.unlockedAchievements.join(", ")}`);
    }

    if (unlockLines.length > 0) {
      this.unlockLabel.setText(unlockLines.join("\n"));
      this.unlockLabel.setAlpha(1);
      this.audioSystem.unlock();
    } else {
      this.unlockLabel.setAlpha(0);
    }

    void this.submitRemoteScore();

    this.overlay.setVisible(true);
    this.overlay.setAlpha(0);
    this.tweens.add({
      targets: this.overlay,
      alpha: 1,
      duration: 220,
      ease: "quad.out"
    });
  }

  private showFloatingText(x: number, y: number, message: string, color: string): void {
    const text = this.add
      .text(x, y, message, {
        fontFamily: "Outfit",
        fontSize: "22px",
        color,
        stroke: "#111827",
        strokeThickness: 5,
        fontStyle: "700"
      })
      .setOrigin(0.5)
      .setDepth(105);

    this.tweens.add({
      targets: text,
      y: y - 46,
      alpha: 0,
      duration: 620,
      ease: "quad.out",
      onComplete: () => text.destroy()
    });
  }

  private destroyPair(pair: PipePair): void {
    pair.top.destroy();
    pair.bottom.destroy();
    pair.topCap.destroy();
    pair.bottomCap.destroy();
    pair.glow.destroy();
    pair.coin?.destroy();
  }

  private getRunElapsedMs(): number {
    if (this.runStartedAtMs <= 0) {
      return 0;
    }
    return Math.max(0, Math.round(this.time.now - this.runStartedAtMs));
  }

  private async openRemoteScoreSession(): Promise<void> {
    this.scoreSession = await ScoreService.createSession(this.username);
  }

  private async submitRemoteScore(): Promise<void> {
    if (!this.scoreSession) {
      return;
    }

    const result = await ScoreService.submitRun(this.username, this.scoreSession, {
      durationMs: this.getRunElapsedMs(),
      score: this.score,
      coins: this.coinsRun,
      nearMisses: this.nearMisses,
      flaps: this.flapEvents.length,
      passEvents: [...this.passEvents],
      coinEvents: [...this.coinEvents],
      nearMissEvents: [...this.nearMissEvents],
      flapEvents: [...this.flapEvents]
    });

    this.scoreSession = null;

    if (result.accepted) {
      const rankText = typeof result.rank === "number" ? `Global rank #${result.rank}` : "Global rank updated";
      const bestText = typeof result.bestScore === "number" ? `best ${result.bestScore}` : "";
      this.remoteResultText = `${rankText}${bestText ? ` (${bestText})` : ""}`;
    } else {
      this.remoteResultText = this.mapGlobalRejectMessage(result.reason);
    }

    const current = this.unlockLabel.alpha > 0 ? this.unlockLabel.text : "";
    this.unlockLabel.setText([current, this.remoteResultText].filter(Boolean).join("\n"));
    this.unlockLabel.setAlpha(1);
  }

  private mapGlobalRejectMessage(reason?: string): string {
    switch (reason) {
      case "network_error":
        return "Global score offline";
      case "invalid_duration":
      case "first_pass_too_early":
        return "Run too short for global leaderboard";
      case "rate_limited":
        return "Too many attempts, try again soon";
      case "invalid_username":
        return "Invalid username";
      default:
        return "Run rejected by anti-cheat";
    }
  }
}
