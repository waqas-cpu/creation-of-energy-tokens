import { defineConfig } from "vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

const httpsDev = process.env.VITE_HTTPS === "1" || process.argv.includes("--https");

export default defineConfig({
  plugins: [react(), ...(httpsDev ? [basicSsl()] : [])],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: "127.0.0.1",
    port: Number(process.env.VITE_DEV_PORT ?? 5173),
    strictPort: true,
    https: httpsDev,
    proxy: {
      "/settlement-api": {
        target: "http://127.0.0.1:3750",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/settlement-api/, ""),
      },
    },
  },
});
