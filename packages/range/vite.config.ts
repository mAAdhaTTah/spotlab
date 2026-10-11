import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    dts({ include: ["src"], exclude: ["src/**/*.spec.ts", "src/wasm/**"] }),
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
      external: ["zod"],
    },
  },
});
