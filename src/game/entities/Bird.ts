import Phaser from "phaser";
import { BIRD_GRAVITY, DEFAULT_FLAP_POWER } from "../constants";

const FRAME_KEYS = ["bird-frame-0", "bird-frame-1", "bird-frame-2"];

export class Bird extends Phaser.Physics.Arcade.Sprite {
  private frameTimer = 0;
  private frameIndex = 0;
  private isAlive = true;

  public constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, FRAME_KEYS[0]);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setDepth(25);
    this.setScale(1);
    this.setOrigin(0.5);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(38, 30);
    body.setOffset(16, 17);
    body.setAllowGravity(false);
    body.setGravityY(BIRD_GRAVITY);
    body.setCollideWorldBounds(false);
  }

  public applySkin(tint: number): void {
    this.setTint(tint);
  }

  public setGameplayGravity(enabled: boolean): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(enabled);

    if (!enabled) {
      body.setVelocity(0, 0);
    }
  }

  public flap(power = DEFAULT_FLAP_POWER): void {
    if (!this.isAlive) {
      return;
    }

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityY(-power);
    this.frameTimer = 0;
    this.frameIndex = 2;
    this.setTexture(FRAME_KEYS[this.frameIndex]);
  }

  public updateBird(deltaMs: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    this.frameTimer += deltaMs;

    if (this.frameTimer >= 85) {
      this.frameTimer = 0;
      this.frameIndex = (this.frameIndex + 1) % FRAME_KEYS.length;
      this.setTexture(FRAME_KEYS[this.frameIndex]);
    }

    const targetAngle = Phaser.Math.Clamp(body.velocity.y * 0.06, -24, 85);
    this.angle = Phaser.Math.Linear(this.angle, targetAngle, 0.15);
  }

  public getHitbox(): Phaser.Geom.Rectangle {
    const bounds = this.getBounds();
    return new Phaser.Geom.Rectangle(bounds.x + 8, bounds.y + 7, bounds.width - 18, bounds.height - 14);
  }

  public kill(): void {
    this.isAlive = false;
  }

  public revive(): void {
    this.isAlive = true;
  }

  public getVelocityY(): number {
    return (this.body as Phaser.Physics.Arcade.Body).velocity.y;
  }

  public pushVertical(velocityDelta: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.velocity.y += velocityDelta;
  }
}
