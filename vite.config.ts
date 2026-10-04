/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Tauri expects a fixed dev port and leaves the terminal output alone so the
// Rust side can print its own logs. Build output goes to ../dist (see
// src-tauri/tauri.conf.json -> build.frontendDist).
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  // Expose Tauri's build-time env vars (TAURI_ENV_*) alongside VITE_*.
  envPrefix: ["VITE_", "TAURI_ENV_"],
  build: {
    // The Windows app runs in WebView2 (Chromium), so target it directly.
    target: "chrome105",
    // Keep debug builds debuggable; release builds stay small.
    minify: process.env.TAURI_ENV_DEBUG ? false : "esbuild",
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    // Everything is loaded from disk inside the app, so one ~0.5 MB bundle is
    // fine — this just silences the web-oriented size warning.
    chunkSizeWarningLimit: 1500,
  },
  // Vitest picks up *.test.ts next to the code.
  test: { environment: "node", include: ["src/**/*.test.ts"] },
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
});
