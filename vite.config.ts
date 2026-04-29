// Netlify SSR build for TanStack Start.
// Uses the official Netlify TanStack Start plugin for Functions deployment.
import { defineConfig } from "vite";
import path from "node:path";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import netlify from "@netlify/vite-plugin-tanstack-start";
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
    netlify(),
    viteReact(),
  ],
  server: {
    host: true,
    port: 8080,
    strictPort: false,
  },
});
