import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const port = env.PORT || process.env.PORT || "3000";
  const target = env.VITE_API_PROXY_TARGET || `http://127.0.0.1:${port}`;
  const clientPort = Number(env.VITE_PORT || process.env.VITE_PORT || 5173);
  const clientHost = env.VITE_HOST || process.env.VITE_HOST || "0.0.0.0";

  return {
    plugins: [react()],
    // Only logos/icons — not `public/uploads` (PDFs). Uploads are served by Express at /uploads.
    publicDir: "client-public",
    build: {
      outDir: "dist",
      emptyOutDir: true
    },
    server: {
      host: clientHost,
      port: clientPort,
      proxy: {
        "/api": { target, changeOrigin: true }
      }
    }
  };
});
