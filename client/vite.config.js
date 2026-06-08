import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
  build: { outDir: "dist", emptyOutDir: true },
  // For `npm run dev` only: proxy API to the Electron-hosted Express server.
  server: { proxy: { "/api": "http://127.0.0.1:38917" } },
});
