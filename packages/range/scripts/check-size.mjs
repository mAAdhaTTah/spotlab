import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const INLINE_BUDGET_BYTES = 250 * 1024;
const PACKAGE_BUDGET_BYTES = 300 * 1024;

const kib = (bytes) => (bytes / 1024).toFixed(1);

function inlineModuleSize() {
  const dir = fileURLToPath(new URL("../dist/", import.meta.url));
  return statSync(`${dir}index.js`).size + statSync(`${dir}index.d.ts`).size;
}

function packedUnpackedSize() {
  const stdout = execFileSync("npm", ["pack", "--dry-run", "--json"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    encoding: "utf8",
  });
  const [{ unpackedSize }] = JSON.parse(stdout);
  return unpackedSize;
}

const inlineSize = inlineModuleSize();
const packageSize = packedUnpackedSize();

let failed = false;

if (inlineSize > INLINE_BUDGET_BYTES) {
  console.error(
    `@spotlab/range: bundled entry (index.js + index.d.ts) is ${kib(inlineSize)} KiB, over the ${kib(INLINE_BUDGET_BYTES)} KiB budget.`,
  );
  failed = true;
} else {
  console.log(
    `@spotlab/range: bundled entry (index.js + index.d.ts) is ${kib(inlineSize)} KiB (budget ${kib(INLINE_BUDGET_BYTES)} KiB).`,
  );
}

if (packageSize > PACKAGE_BUDGET_BYTES) {
  console.error(
    `@spotlab/range: packed unpacked size is ${kib(packageSize)} KiB, over the ${kib(PACKAGE_BUDGET_BYTES)} KiB budget.`,
  );
  failed = true;
} else {
  console.log(
    `@spotlab/range: packed unpacked size is ${kib(packageSize)} KiB (budget ${kib(PACKAGE_BUDGET_BYTES)} KiB).`,
  );
}

if (failed) {
  process.exit(1);
}
