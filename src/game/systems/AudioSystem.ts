import Phaser from "phaser";

type OscType = OscillatorType;

export class AudioSystem {
  private context: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private enabled = true;

  public constructor(scene: Phaser.Scene) {
    const manager = scene.sound as Phaser.Sound.WebAudioSoundManager;

    if (manager.context) {
      this.context = manager.context;
      this.gainNode = this.context.createGain();
      this.gainNode.gain.value = 0.7;
      this.gainNode.connect(this.context.destination);
    }

    scene.input.once("pointerdown", () => {
      void this.resume();
    });

    scene.input.keyboard?.once("keydown", () => {
      void this.resume();
    });
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public async resume(): Promise<void> {
    if (!this.context) {
      return;
    }

    if (this.context.state === "suspended") {
      await this.context.resume();
    }
  }

  public flap(): void {
    this.tone(510, 320, 0.08, "triangle", 0.1);
  }

  public score(): void {
    this.tone(640, 760, 0.1, "sine", 0.12);
  }

  public coin(): void {
    this.tone(860, 1180, 0.12, "triangle", 0.1);
  }

  public nearMiss(): void {
    this.tone(450, 690, 0.09, "square", 0.08);
  }

  public hit(): void {
    this.tone(240, 80, 0.22, "sawtooth", 0.13);
  }

  public unlock(): void {
    this.tone(450, 700, 0.12, "sine", 0.09);
    this.tone(700, 980, 0.2, "triangle", 0.09, 0.06);
  }

  private tone(
    from: number,
    to: number,
    duration: number,
    type: OscType,
    volume: number,
    delay = 0
  ): void {
    if (!this.enabled || !this.context || !this.gainNode) {
      return;
    }

    const now = this.context.currentTime + delay;

    const osc = this.context.createOscillator();
    const gain = this.context.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(from, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), now + duration);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + duration * 0.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.gainNode);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }
}
