import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss(), solidPlugin()],
  server: {
    host: "127.0.0.1",
    port: 5000,
    allowedHosts: ["localhost", "127.0.0.1", "skywell.dev"],
  },
  build: {
    target: "esnext",
  },
  preview: {
    host: "127.0.0.1",
    port: 5000,
    allowedHosts: ["skywell.dev"],
  },
});
