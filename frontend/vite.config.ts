import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The backend has no CORS middleware, so the dev server proxies /api to it
// and the browser only ever talks to a single origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.API_URL ?? "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
