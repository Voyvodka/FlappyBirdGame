import Phaser from "phaser";

type Drawer = (ctx: CanvasRenderingContext2D, width: number, height: number) => void;

const createCanvasTexture = (scene: Phaser.Scene, key: string, width: number, height: number, draw: Drawer): void => {
  if (scene.textures.exists(key)) {
    return;
  }

  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) {
    return;
  }
  const ctx = texture.context;
  ctx.clearRect(0, 0, width, height);
  draw(ctx, width, height);
  texture.refresh();
};

const roundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

const addNoise = (ctx: CanvasRenderingContext2D, width: number, height: number, alpha: number, amount: number): void => {
  ctx.save();
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  for (let i = 0; i < amount; i += 1) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const size = Math.random() * 1.4 + 0.2;
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();
};

const drawStar = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string): void => {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const r = i % 2 === 0 ? radius : radius * 0.45;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

const drawBirdFrame = (ctx: CanvasRenderingContext2D, wingRotation: number): void => {
  const bodyGradient = ctx.createLinearGradient(14, 12, 54, 54);
  bodyGradient.addColorStop(0, "#fff6bf");
  bodyGradient.addColorStop(1, "#ffb140");

  const bellyGradient = ctx.createLinearGradient(24, 26, 44, 52);
  bellyGradient.addColorStop(0, "#fff3d6");
  bellyGradient.addColorStop(1, "#f4cf8a");

  ctx.save();
  ctx.translate(32, 32);
  ctx.rotate(wingRotation);
  ctx.fillStyle = "#f28444";
  ctx.beginPath();
  ctx.ellipse(-4, 8, 16, 11, -0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#e26d30";
  ctx.beginPath();
  ctx.ellipse(-7, 9, 11, 7, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = bodyGradient;
  ctx.beginPath();
  ctx.ellipse(34, 31, 19, 18, -0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = bellyGradient;
  ctx.beginPath();
  ctx.ellipse(38, 36, 11, 10, -0.12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f97316";
  ctx.beginPath();
  ctx.moveTo(50, 31);
  ctx.lineTo(66, 26);
  ctx.lineTo(52, 38);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(39, 24, 5.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#18181b";
  ctx.beginPath();
  ctx.arc(41, 24.5, 2.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(0,0,0,0.2)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(34, 31, 19, 0.2, Math.PI * 1.8);
  ctx.stroke();
};

const createBackgroundTextures = (scene: Phaser.Scene): void => {
  createCanvasTexture(scene, "bg-sky", 1024, 1024, (ctx, width, height) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#5ac8fa");
    gradient.addColorStop(0.52, "#9fe7f4");
    gradient.addColorStop(0.78, "#fbd38d");
    gradient.addColorStop(1, "#f59e5b");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const sun = ctx.createRadialGradient(780, 240, 40, 780, 240, 220);
    sun.addColorStop(0, "rgba(255,248,220,0.95)");
    sun.addColorStop(1, "rgba(255,248,220,0)");
    ctx.fillStyle = sun;
    ctx.fillRect(550, 0, 450, 460);

    addNoise(ctx, width, height, 0.05, 6000);
  });

  createCanvasTexture(scene, "bg-clouds", 1024, 256, (ctx, width, height) => {
    ctx.clearRect(0, 0, width, height);
    for (let i = 0; i < 20; i += 1) {
      const x = (i / 20) * width + Math.random() * 50;
      const y = 40 + Math.random() * 150;
      const cloudWidth = 90 + Math.random() * 130;
      const cloudHeight = 28 + Math.random() * 24;

      ctx.fillStyle = "rgba(255,255,255,0.32)";
      ctx.beginPath();
      ctx.ellipse(x, y, cloudWidth * 0.25, cloudHeight * 0.5, 0, 0, Math.PI * 2);
      ctx.ellipse(x + cloudWidth * 0.22, y - 10, cloudWidth * 0.19, cloudHeight * 0.46, 0, 0, Math.PI * 2);
      ctx.ellipse(x + cloudWidth * 0.42, y, cloudWidth * 0.26, cloudHeight * 0.52, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  createCanvasTexture(scene, "bg-mountains", 1024, 280, (ctx, width, height) => {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "rgba(74,114,100,0.7)");
    grad.addColorStop(1, "rgba(42,74,68,0.9)");
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let x = 0; x <= width + 64; x += 64) {
      const peak = 50 + Math.sin(x * 0.01) * 20 + Math.random() * 35;
      ctx.lineTo(x, height - peak);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(173, 213, 190, 0.25)";
    for (let i = 0; i < 20; i += 1) {
      const x = Math.random() * width;
      const y = 90 + Math.random() * 130;
      const w = 45 + Math.random() * 65;
      const h = 8 + Math.random() * 12;
      ctx.fillRect(x, y, w, h);
    }
  });

  createCanvasTexture(scene, "bg-city", 1024, 300, (ctx, width, height) => {
    const base = ctx.createLinearGradient(0, 0, 0, height);
    base.addColorStop(0, "rgba(46,72,86,0.1)");
    base.addColorStop(1, "rgba(24,43,54,0.8)");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < 48; i += 1) {
      const x = i * 24 + Math.random() * 8;
      const w = 18 + Math.random() * 16;
      const h = 80 + Math.random() * 170;
      ctx.fillStyle = "rgba(15, 29, 37, 0.9)";
      ctx.fillRect(x, height - h, w, h);

      ctx.fillStyle = "rgba(255, 217, 124, 0.3)";
      for (let wy = height - h + 8; wy < height - 12; wy += 12) {
        if (Math.random() > 0.55) {
          ctx.fillRect(x + 3, wy, 4, 5);
        }
        if (Math.random() > 0.58) {
          ctx.fillRect(x + 10, wy, 4, 5);
        }
      }
    }
  });

  createCanvasTexture(scene, "bg-foreground", 1024, 220, (ctx, width, height) => {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "rgba(36,92,62,0.8)");
    grad.addColorStop(1, "rgba(22,56,40,0.95)");
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let x = 0; x <= width + 8; x += 16) {
      const y = height - 36 - Math.sin(x * 0.04) * 8 - Math.random() * 10;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    for (let i = 0; i < 240; i += 1) {
      ctx.strokeStyle = i % 2 === 0 ? "rgba(143, 220, 159, 0.45)" : "rgba(107, 181, 122, 0.35)";
      ctx.lineWidth = 1;
      const x = Math.random() * width;
      const y = height - 14 - Math.random() * 46;
      ctx.beginPath();
      ctx.moveTo(x, height);
      ctx.quadraticCurveTo(x + (Math.random() * 8 - 4), y, x + (Math.random() * 6 - 3), y - 10);
      ctx.stroke();
    }
  });

  createCanvasTexture(scene, "bg-ground", 1024, 140, (ctx, width, height) => {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#5a3c2f");
    grad.addColorStop(1, "#2f1f18");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < 260; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? "rgba(255, 232, 186, 0.14)" : "rgba(50, 27, 18, 0.2)";
      const x = Math.random() * width;
      const y = Math.random() * height;
      const w = Math.random() * 14 + 4;
      const h = Math.random() * 4 + 2;
      ctx.fillRect(x, y, w, h);
    }
  });
};

const createPipeTextures = (scene: Phaser.Scene): void => {
  createCanvasTexture(scene, "pipe-body", 96, 520, (ctx, width, height) => {
    const grad = ctx.createLinearGradient(0, 0, width, 0);
    grad.addColorStop(0, "#16a34a");
    grad.addColorStop(0.45, "#4ade80");
    grad.addColorStop(1, "#166534");
    ctx.fillStyle = grad;
    roundedRect(ctx, 4, 0, width - 8, height, 10);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
    for (let y = 16; y < height; y += 28) {
      ctx.fillRect(16, y, width - 44, 5);
    }

    ctx.fillStyle = "rgba(0,0,0,0.18)";
    for (let i = 0; i < 18; i += 1) {
      const y = 18 + i * 28;
      ctx.beginPath();
      ctx.arc(width - 20, y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(14, 8);
    ctx.lineTo(14, height - 8);
    ctx.stroke();
  });

  createCanvasTexture(scene, "pipe-cap", 132, 44, (ctx, width, height) => {
    const grad = ctx.createLinearGradient(0, 0, width, 0);
    grad.addColorStop(0, "#0f8a3d");
    grad.addColorStop(0.5, "#5ee59a");
    grad.addColorStop(1, "#0f8a3d");
    ctx.fillStyle = grad;
    roundedRect(ctx, 2, 2, width - 4, height - 4, 10);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(10, 9, width - 20, 5);
    ctx.fillStyle = "rgba(0,0,0,0.16)";
    ctx.fillRect(8, height - 12, width - 16, 4);
  });

  createCanvasTexture(scene, "pipe-glow", 180, 240, (ctx, width, height) => {
    const grad = ctx.createRadialGradient(width / 2, height / 2, 12, width / 2, height / 2, width / 2);
    grad.addColorStop(0, "rgba(255,255,255,0.65)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  });
};

const createUiTextures = (scene: Phaser.Scene): void => {
  createCanvasTexture(scene, "ui-panel", 520, 330, (ctx, width, height) => {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "rgba(255, 251, 235, 0.98)");
    grad.addColorStop(1, "rgba(248, 225, 189, 0.95)");

    roundedRect(ctx, 0, 0, width, height, 24);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = "rgba(147, 82, 37, 0.45)";
    ctx.lineWidth = 4;
    roundedRect(ctx, 8, 8, width - 16, height - 16, 20);
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    roundedRect(ctx, 16, 14, width - 32, 46, 14);
    ctx.fill();
  });

  createCanvasTexture(scene, "ui-button", 270, 84, (ctx, width, height) => {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#f5b94f");
    grad.addColorStop(1, "#e48c2a");

    roundedRect(ctx, 0, 0, width, height, 18);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.25)";
    roundedRect(ctx, 8, 8, width - 16, 24, 12);
    ctx.fill();

    ctx.strokeStyle = "rgba(95, 47, 17, 0.55)";
    ctx.lineWidth = 3;
    roundedRect(ctx, 1.5, 1.5, width - 3, height - 3, 17);
    ctx.stroke();
  });

  createCanvasTexture(scene, "ui-pill", 220, 62, (ctx, width, height) => {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "rgba(50, 77, 96, 0.9)");
    grad.addColorStop(1, "rgba(24, 41, 56, 0.92)");

    roundedRect(ctx, 0, 0, width, height, 31);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 2;
    roundedRect(ctx, 2, 2, width - 4, height - 4, 29);
    ctx.stroke();
  });
};

const createGameplayTextures = (scene: Phaser.Scene): void => {
  createCanvasTexture(scene, "coin", 64, 64, (ctx, width, height) => {
    const grad = ctx.createRadialGradient(width / 2, height / 2, 8, width / 2, height / 2, 28);
    grad.addColorStop(0, "#fff2a8");
    grad.addColorStop(0.5, "#ffd166");
    grad.addColorStop(1, "#f4a321");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 28, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(136, 78, 18, 0.55)";
    ctx.stroke();

    drawStar(ctx, width / 2, height / 2, 12, "rgba(255, 255, 255, 0.75)");
  });

  createCanvasTexture(scene, "particle-glow", 32, 32, (ctx, width, height) => {
    const grad = ctx.createRadialGradient(width / 2, height / 2, 1, width / 2, height / 2, width / 2);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  });

  createCanvasTexture(scene, "particle-spark", 26, 10, (ctx, width, height) => {
    const grad = ctx.createLinearGradient(0, 0, width, 0);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(0.3, "rgba(255,255,255,0.8)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    roundedRect(ctx, 0, 0, width, height, 6);
    ctx.fill();
  });

  createCanvasTexture(scene, "wind-layer", 512, 256, (ctx, width, height) => {
    for (let i = 0; i < 65; i += 1) {
      ctx.strokeStyle = i % 3 === 0 ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.15)";
      ctx.lineWidth = Math.random() * 2 + 1;
      const y = (i / 64) * height + Math.random() * 6;
      ctx.beginPath();
      ctx.moveTo(-20, y);
      ctx.lineTo(width + 20, y + Math.random() * 12 - 6);
      ctx.stroke();
    }
  });
};

const createBirdTextures = (scene: Phaser.Scene): void => {
  const wingAngles = [-0.55, -0.12, 0.45];
  wingAngles.forEach((angle, index) => {
    createCanvasTexture(scene, `bird-frame-${index}`, 72, 64, (ctx) => {
      drawBirdFrame(ctx, angle);
    });
  });
};

export class ProceduralAssets {
  public static create(scene: Phaser.Scene): void {
    createBackgroundTextures(scene);
    createPipeTextures(scene);
    createUiTextures(scene);
    createGameplayTextures(scene);
    createBirdTextures(scene);
  }
}
