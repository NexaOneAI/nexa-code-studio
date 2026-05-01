// SSR build for TanStack Start on Lovable Cloud (Cloudflare Worker runtime).
// El plugin de Netlify se quitó porque emitía un server.js que importa
// "h3-v2" como módulo externo, lo cual el Worker no puede resolver y
// devuelve 502 / "Internal server error".
import { defineConfig } from "vite";
import path from "node:path";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-start"],
  },
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  server: {
    host: true,
    port: 8080,
    strictPort: false,
  },
});
