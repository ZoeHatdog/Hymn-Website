import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const port = Number(env.WEB_PORT || 3001);
  const host = env.WEB_HOST || "0.0.0.0";
  const apiBaseUrl = (env.API_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");

  return {
    plugins: [react()],
    server: {
      port,
      host,
      proxy: {
        "/api": {
          target: apiBaseUrl,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port,
      host,
      proxy: {
        "/api": {
          target: apiBaseUrl,
          changeOrigin: true,
        },
      },
    },
  };
});
