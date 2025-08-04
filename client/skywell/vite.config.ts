import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss(), solidPlugin()],
  server: {
    host: '127.0.0.1',
    port: 3000,
  },
  build: {
    target: "esnext",
  },
});
