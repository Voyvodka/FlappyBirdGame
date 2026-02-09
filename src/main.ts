import Phaser from "phaser";
import { inject } from "@vercel/analytics";
import { injectSpeedInsights } from "@vercel/speed-insights";
import "./styles.css";
import { gameConfig } from "./game/GameConfig";

const installImmersiveHints = (): void => {
  const enterImmersive = async (): Promise<void> => {
    const doc = document as Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => Promise<void> };
    const root = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };

    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
    const isFullscreen = Boolean(document.fullscreenElement || doc.webkitFullscreenElement);

    if (!isStandalone && !isFullscreen) {
      try {
        if (root.requestFullscreen) {
          await root.requestFullscreen();
        } else if (root.webkitRequestFullscreen) {
          await root.webkitRequestFullscreen();
        }
      } catch {
        return;
      }
    }

    try {
      const orientation = screen.orientation as ScreenOrientation & { lock?: (orientation: "portrait") => Promise<void> };
      if (orientation.lock) {
        await orientation.lock("portrait");
      }
    } catch {
      return;
    }
  };

  window.addEventListener(
    "pointerdown",
    () => {
      void enterImmersive();
    },
    { once: true, passive: true }
  );
};

const registerServiceWorker = (): void => {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
    return;
  }

  void window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js");
  });
};

if (import.meta.env.PROD) {
  inject();
  injectSpeedInsights();
}

installImmersiveHints();
registerServiceWorker();

void new Phaser.Game(gameConfig);
