import { defineConfig } from "vite";

const buildId = Date.now().toString();

export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(buildId)
  },
  server: {
    host: true,
    port: 5173
  },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ["phaser"]
        }
      }
    }
  }
});
