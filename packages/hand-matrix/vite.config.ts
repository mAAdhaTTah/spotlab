import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    react(),
    dts({
      include: ["src"],
      exclude: ["src/**/*.spec.ts", "src/**/*.stories.tsx"],
    }),
  ],
  build: {
    target: "es2022",
    minify: "esbuild",
    lib: {
      entry: fileURLToPath(new URL("src/index.ts", import.meta.url)),
      formats: ["es"],
      fileName: () => "index.js",
    },
    rollupOptions: {
      external: ["react", "react/jsx-runtime", "react-dom", "@spotlab/range"],
    },
  },
});
