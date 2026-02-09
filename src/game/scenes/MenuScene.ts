import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, SKINS } from "../constants";
import { SaveManager } from "../data/SaveManager";
import { ScoreService } from "../network/ScoreService";
import type { SaveData, SkinDefinition } from "../types";

export class MenuScene extends Phaser.Scene {
  private sky!: Phaser.GameObjects.TileSprite;
  private clouds!: Phaser.GameObjects.TileSprite;
  private mountains!: Phaser.GameObjects.TileSprite;
  private city!: Phaser.GameObjects.TileSprite;
  private foreground!: Phaser.GameObjects.TileSprite;

  private saveData!: SaveData;
  private selectedSkinIndex = 0;

  private previewBird!: Phaser.GameObjects.Image;
  private skinTitle!: Phaser.GameObjects.Text;
  private skinHint!: Phaser.GameObjects.Text;
  private bestLabel!: Phaser.GameObjects.Text;
  private coinLabel!: Phaser.GameObjects.Text;
  private toastLabel!: Phaser.GameObjects.Text;
  private globalLeaderboardLabel!: Phaser.GameObjects.Text;
  private localLeaderboardLabel!: Phaser.GameObjects.Text;
  private usernameValue!: Phaser.GameObjects.Text;

  public constructor() {
    super("MenuScene");
  }

  public create(): void {
    const loaded = SaveManager.ensureScoreBasedUnlocks(SaveManager.load());
    this.saveData = loaded.updated;

    const currentIndex = SKINS.findIndex((skin) => skin.id === this.saveData.selectedSkin);
    this.selectedSkinIndex = currentIndex >= 0 ? currentIndex : 0;

    this.createBackground();
    this.createTitleArea();
    this.createSkinSelector();
    this.createUsernamePanel();
    this.createButtons();
    this.createStats();
    this.createLeaderboard();
    this.createToast();
    this.bindControls();

    this.cameras.main.fadeIn(320, 0, 0, 0);
  }

  public update(_time: number, delta: number): void {
    this.sky.tilePositionX += 0.008 * delta;
    this.clouds.tilePositionX += 0.02 * delta;
    this.mountains.tilePositionX += 0.035 * delta;
    this.city.tilePositionX += 0.07 * delta;
    this.foreground.tilePositionX += 0.12 * delta;
  }

  private createBackground(): void {
    this.sky = this.add.tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, "bg-sky").setDepth(0);
    this.clouds = this.add
      .tileSprite(GAME_WIDTH / 2, GAME_HEIGHT * 0.24, GAME_WIDTH, 220, "bg-clouds")
      .setAlpha(0.85)
      .setDepth(2);
    this.mountains = this.add
      .tileSprite(GAME_WIDTH / 2, GAME_HEIGHT * 0.56, GAME_WIDTH, 220, "bg-mountains")
      .setAlpha(0.72)
      .setDepth(3);
    this.city = this.add.tileSprite(GAME_WIDTH / 2, GAME_HEIGHT * 0.68, GAME_WIDTH, 245, "bg-city").setDepth(4);
    this.foreground = this.add
      .tileSprite(GAME_WIDTH / 2, GAME_HEIGHT - 95, GAME_WIDTH, 190, "bg-foreground")
      .setDepth(5)
      .setAlpha(0.92);

    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0f172a, 0.12)
      .setDepth(6)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);
  }

  private createTitleArea(): void {
    const title = this.add
      .text(GAME_WIDTH / 2, 112, "ULTRA FLAPPY", {
        fontFamily: "Changa",
        fontSize: "58px",
        color: "#fff7e1",
        stroke: "#6f3d1f",
        strokeThickness: 10
      })
      .setOrigin(0.5)
      .setDepth(20);

    this.add
      .text(GAME_WIDTH / 2, 164, "HORIZON EDITION", {
        fontFamily: "Outfit",
        fontSize: "20px",
        color: "#fef3c7",
        letterSpacing: 4
      })
      .setOrigin(0.5)
      .setDepth(20);

    this.tweens.add({
      targets: title,
      y: title.y + 8,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: "sine.inOut"
    });
  }

  private createSkinSelector(): void {
    this.add.image(GAME_WIDTH / 2, 336, "ui-panel").setScale(0.78, 0.56).setDepth(18).setAlpha(0.95);

    this.previewBird = this.add.image(GAME_WIDTH / 2, 315, "bird-frame-1").setDepth(22).setScale(1.55);

    const left = this.add
      .text(122, 316, "<", {
        fontFamily: "Changa",
        fontSize: "48px",
        color: "#7c2d12"
      })
      .setOrigin(0.5)
      .setDepth(22)
      .setInteractive({ useHandCursor: true });

    const right = this.add
      .text(358, 316, ">", {
        fontFamily: "Changa",
        fontSize: "48px",
        color: "#7c2d12"
      })
      .setOrigin(0.5)
      .setDepth(22)
      .setInteractive({ useHandCursor: true });

    left.on("pointerdown", () => this.shiftSkin(-1));
    right.on("pointerdown", () => this.shiftSkin(1));

    this.skinTitle = this.add
      .text(GAME_WIDTH / 2, 378, "", {
        fontFamily: "Outfit",
        fontSize: "28px",
        color: "#12253b",
        fontStyle: "700"
      })
      .setOrigin(0.5)
      .setDepth(22);

    this.skinHint = this.add
      .text(GAME_WIDTH / 2, 410, "", {
        fontFamily: "Outfit",
        fontSize: "17px",
        color: "#34516a"
      })
      .setOrigin(0.5)
      .setDepth(22);

    this.refreshSkinUI();
  }

  private createButtons(): void {
    this.createActionButton(GAME_WIDTH / 2, 560, "PLAY", () => this.startGame());
    this.createActionButton(GAME_WIDTH / 2, 640, "RANDOM SKIN", () => {
      this.pickRandomUnlockedSkin();
    });
  }

  private createUsernamePanel(): void {
    this.add.image(GAME_WIDTH / 2, 490, "ui-pill").setScale(1.24, 0.9).setDepth(20);

    this.add
      .text(GAME_WIDTH / 2, 476, "GLOBAL USERNAME", {
        fontFamily: "Outfit",
        fontSize: "13px",
        color: "#cbd5e1",
        fontStyle: "700",
        letterSpacing: 1
      })
      .setOrigin(0.5)
      .setDepth(22);

    const editButton = this.add
      .text(GAME_WIDTH / 2 + 90, 498, "EDIT", {
        fontFamily: "Outfit",
        fontSize: "13px",
        color: "#fde68a",
        fontStyle: "700",
        backgroundColor: "rgba(124, 45, 18, 0.35)",
        padding: {
          x: 8,
          y: 4
        }
      })
      .setOrigin(0.5, 0.52)
      .setDepth(23)
      .setInteractive({ useHandCursor: true });

    editButton.on("pointerdown", () => {
      this.editUsername();
    });

    this.usernameValue = this.add
      .text(GAME_WIDTH / 2, 500, ScoreService.getUsername(), {
        fontFamily: "Outfit",
        fontSize: "22px",
        color: "#f8fafc",
        fontStyle: "700"
      })
      .setOrigin(0.5)
      .setDepth(22);
  }

  private editUsername(): void {
    const raw = window.prompt("Enter username (3-16, a-z, 0-9, _ or -)", ScoreService.getUsername());
    if (raw === null) {
      return;
    }

    const username = ScoreService.setUsername(raw);
    this.usernameValue.setText(username);
    this.showToast(`Username: ${username}`);
  }

  private createStats(): void {
    this.add.image(130, 730, "ui-pill").setScale(0.95, 0.86).setDepth(20);
    this.add.image(350, 730, "ui-pill").setScale(0.95, 0.86).setDepth(20);

    this.bestLabel = this.add
      .text(130, 733, "BEST 0", {
        fontFamily: "Outfit",
        fontSize: "22px",
        color: "#f8fafc",
        fontStyle: "700"
      })
      .setOrigin(0.5)
      .setDepth(22);

    this.coinLabel = this.add
      .text(350, 733, "COINS 0", {
        fontFamily: "Outfit",
        fontSize: "22px",
        color: "#f8fafc",
        fontStyle: "700"
      })
      .setOrigin(0.5)
      .setDepth(22);

    this.bestLabel.setText(`BEST ${this.saveData.bestScore}`);
    this.coinLabel.setText(`COINS ${this.saveData.coins}`);
  }

  private createLeaderboard(): void {
    const leftX = 120;
    const rightX = 360;
    const panelY = 800;

    this.add.image(leftX, panelY, "ui-pill").setScale(1.02, 1.08).setDepth(20);
    this.add.image(rightX, panelY, "ui-pill").setScale(1.02, 1.08).setDepth(20);

    this.add
      .text(leftX, 776, "GLOBAL TOP", {
        fontFamily: "Outfit",
        fontSize: "14px",
        color: "#dbeafe",
        fontStyle: "700",
        letterSpacing: 1
      })
      .setOrigin(0.5)
      .setDepth(22);

    this.add
      .text(rightX, 776, "LOCAL TOP", {
        fontFamily: "Outfit",
        fontSize: "14px",
        color: "#fff8dd",
        fontStyle: "700",
        letterSpacing: 1
      })
      .setOrigin(0.5)
      .setDepth(22);

    const localTop = this.saveData.localLeaderboard.slice(0, 2);
    const localText = localTop.length > 0 ? localTop.map((score, idx) => `#${idx + 1}  ${score}`).join("\n") : "No records";

    this.localLeaderboardLabel = this.add
      .text(rightX, 808, localText, {
        fontFamily: "Outfit",
        fontSize: "13px",
        color: "#fef3c7",
        align: "center",
        lineSpacing: 5
      })
      .setOrigin(0.5)
      .setDepth(22);

    this.globalLeaderboardLabel = this.add
      .text(leftX, 808, "Loading...", {
        fontFamily: "Outfit",
        fontSize: "13px",
        color: "#dbeafe",
        align: "center",
        lineSpacing: 5
      })
      .setOrigin(0.5)
      .setDepth(22);

    void this.loadGlobalLeaderboard();
  }

  private async loadGlobalLeaderboard(): Promise<void> {
    const entries = await ScoreService.fetchTop(2);
    if (entries.length === 0 && import.meta.env.DEV) {
      const mockEntries = [
        { rank: 1, username: "alpha", score: 42 },
        { rank: 2, username: "beta", score: 28 }
      ];
      const mockText = mockEntries.map((item) => `#${item.rank}  ${this.compactName(item.username)}  ${item.score}`).join("\n");
      this.globalLeaderboardLabel.setText(mockText);
      this.globalLeaderboardLabel.setColor("#c7f9cc");
      return;
    }

    if (entries.length === 0) {
      this.globalLeaderboardLabel.setText("Unavailable");
      return;
    }

    const text = entries.map((item) => `#${item.rank}  ${this.compactName(item.username)}  ${item.score}`).join("\n");
    this.globalLeaderboardLabel.setText(text);
  }

  private compactName(name: string): string {
    return name.length > 8 ? `${name.slice(0, 7)}...` : name;
  }

  private createToast(): void {
    this.toastLabel = this.add
      .text(GAME_WIDTH / 2, 460, "", {
        fontFamily: "Outfit",
        fontSize: "18px",
        color: "#fff7ed",
        backgroundColor: "rgba(17, 24, 39, 0.75)",
        padding: {
          x: 10,
          y: 6
        }
      })
      .setOrigin(0.5)
      .setDepth(50)
      .setAlpha(0);
  }

  private bindControls(): void {
    this.input.keyboard?.on("keydown-LEFT", () => this.shiftSkin(-1));
    this.input.keyboard?.on("keydown-RIGHT", () => this.shiftSkin(1));
    this.input.keyboard?.on("keydown-ENTER", () => this.startGame());
    this.input.keyboard?.on("keydown-SPACE", () => this.startGame());
  }

  private shiftSkin(direction: 1 | -1): void {
    this.selectedSkinIndex = Phaser.Math.Wrap(this.selectedSkinIndex + direction, 0, SKINS.length);
    this.refreshSkinUI();
  }

  private pickRandomUnlockedSkin(): void {
    const unlocked = SKINS.filter((skin) => this.isSkinUnlocked(skin));
    const pick = Phaser.Utils.Array.GetRandom(unlocked);
    const idx = SKINS.findIndex((item) => item.id === pick.id);
    this.selectedSkinIndex = idx;
    this.refreshSkinUI();
  }

  private refreshSkinUI(): void {
    const skin = SKINS[this.selectedSkinIndex];
    const unlocked = this.isSkinUnlocked(skin);

    this.previewBird.setTint(skin.tint);
    this.previewBird.setAlpha(unlocked ? 1 : 0.45);

    this.skinTitle.setText(skin.name.toUpperCase());
    this.skinHint.setText(unlocked ? "Ready to fly" : `Unlock at score ${skin.unlockScore}`);
    this.skinHint.setColor(unlocked ? "#34516a" : "#9f1239");
  }

  private isSkinUnlocked(skin: SkinDefinition): boolean {
    return this.saveData.unlockedSkins.includes(skin.id) || this.saveData.bestScore >= skin.unlockScore;
  }

  private createActionButton(x: number, y: number, label: string, onClick: () => void): void {
    const button = this.add.image(x, y, "ui-button").setScale(0.92).setDepth(24).setInteractive({ useHandCursor: true });
    const text = this.add
      .text(x, y, label, {
        fontFamily: "Changa",
        fontSize: "34px",
        color: "#fff7e6",
        stroke: "#6c2d11",
        strokeThickness: 5
      })
      .setOrigin(0.5)
      .setDepth(25);

    button.on("pointerover", () => {
      button.setScale(0.96);
      text.setScale(1.03);
    });

    button.on("pointerout", () => {
      button.setScale(0.92);
      text.setScale(1);
    });

    button.on("pointerdown", () => {
      button.setTint(0xfff2ce);
      this.time.delayedCall(90, () => button.clearTint());
      onClick();
    });
  }

  private showToast(message: string): void {
    this.toastLabel.setText(message);
    this.toastLabel.setAlpha(1);
    this.tweens.killTweensOf(this.toastLabel);
    this.tweens.add({
      targets: this.toastLabel,
      alpha: 0,
      y: 438,
      duration: 1100,
      ease: "quad.out",
      onStart: () => {
        this.toastLabel.setY(460);
      }
    });
  }

  private startGame(): void {
    const username = ScoreService.setUsername(ScoreService.getUsername());
    this.usernameValue.setText(username);

    const skin = SKINS[this.selectedSkinIndex];
    if (!this.isSkinUnlocked(skin)) {
      this.showToast(`Need score ${skin.unlockScore} for this skin`);
      return;
    }

    this.saveData.selectedSkin = skin.id;
    SaveManager.save(this.saveData);
    this.scene.start("PlayScene", { skinId: skin.id, username });
  }
}
