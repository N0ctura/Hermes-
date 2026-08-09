import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig(() => {
  return {
    root: path.resolve(__dirname),
    plugins: [react(), tailwindcss()],
    base: "/",
    build: {
      outDir: path.resolve(__dirname, "..", "dashboard-dist"),
      emptyOutDir: true,
    },
    server: {
      port: 5173,
      proxy: {
        "/api": "http://localhost:3000",
      },
      hmr: process.env.DISABLE_HMR !== "true",
      watch: process.env.DISABLE_HMR === "true" ? null : {},
    },
  };
});
