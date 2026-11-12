import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Mode normal : appli web classique (dossier dist/).
// Mode "single" : un seul fichier HTML autonome, pratique pour une démonstration.
export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: [react(), ...(mode === "single" ? [viteSingleFile()] : [])],
  build: {
    outDir: mode === "single" ? "dist-single" : "dist",
    assetsInlineLimit: mode === "single" ? 100_000_000 : 4096,
  },
}));
