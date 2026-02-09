import Phaser from "phaser";
import { inject } from "@vercel/analytics";
import { injectSpeedInsights } from "@vercel/speed-insights";
import "./styles.css";
import { gameConfig } from "./game/GameConfig";

const reportClientBootstrapIssue = (source: string, error: unknown): void => {
  const message = error instanceof Error ? error.message : "unknown_error";
  const payload = {
    source,
    message,
    path: window.location.pathname,
    ua: navigator.userAgent.slice(0, 180),
    ts: Date.now()
  };

  try {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/telemetry/client-error", blob);
      return;
    }

    void fetch("/api/telemetry/client-error", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body,
      keepalive: true
    });
  } catch {
    // Never block gameplay startup on telemetry failures.
  }
};

const initializeVercelTelemetry = (): void => {
  if (!import.meta.env.PROD) {
    return;
  }

  try {
    inject();
  } catch (error) {
    reportClientBootstrapIssue("analytics_inject_failed", error);
    // Keep gameplay boot resilient even if analytics fails.
  }

  try {
    injectSpeedInsights();
  } catch (error) {
    reportClientBootstrapIssue("speed_insights_inject_failed", error);
    // Keep gameplay boot resilient even if speed insights fails.
  }
};

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
    void navigator.serviceWorker.register(`/sw.js?v=${__BUILD_ID__}`);
  });
};

initializeVercelTelemetry();

installImmersiveHints();
registerServiceWorker();

void new Phaser.Game(gameConfig);
