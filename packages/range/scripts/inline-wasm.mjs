import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const wasmPath = fileURLToPath(
  new URL("../src/wasm/range_bg.wasm", import.meta.url),
);
const outPath = fileURLToPath(
  new URL("../src/wasm/inline.ts", import.meta.url),
);

const bytes = readFileSync(wasmPath);
writeFileSync(
  outPath,
  `export const WASM_BASE64: string = ${JSON.stringify(bytes.toString("base64"))};\n`,
);
