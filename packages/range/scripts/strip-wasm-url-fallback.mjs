// `wasm-pack --target web` emits a fallback in `range.js`'s init function:
// `new URL('range_bg.wasm', import.meta.url)`, used only when `init()` is
// called with no argument. This package never calls it that way — `init.ts`
// always supplies the already-inlined bytes as `module_or_path` — so the
// fallback is dead code for every call site this package has. Vite's
// `new URL(..., import.meta.url)` asset handling doesn't know that: it
// statically matches the pattern and inlines `range_bg.wasm` a second time
// as a base64 data URL, duplicating the bytes `inline-wasm.mjs` already
// inlined into `inline.ts` and roughly doubling the bundle. Rewriting the
// fallback to throw removes the pattern Vite matches on, so only one copy of
// the wasm bytes ships.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const path = fileURLToPath(new URL("../src/wasm/range.js", import.meta.url));
const source = readFileSync(path, "utf8");

const target = "module_or_path = new URL('range_bg.wasm', import.meta.url);";
const replacement =
  "throw new Error('range.js: init() requires an explicit module_or_path; the range_bg.wasm URL fallback is removed by scripts/strip-wasm-url-fallback.mjs');";

if (!source.includes(target)) {
  throw new Error(
    `strip-wasm-url-fallback: expected wasm-pack's init() fallback line not found in ${path}. wasm-pack's generated output may have changed shape.`,
  );
}

writeFileSync(path, source.replace(target, replacement));
