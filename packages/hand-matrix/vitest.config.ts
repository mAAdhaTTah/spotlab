import { createServer, type AddressInfo } from "node:net";
import { defineConfig } from "vitest/config";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";

// Vitest's browser-mode `api.port` treats `port: 0` as unset and falls back to a fixed
// default, so reserve a concrete ephemeral port from the OS instead.
function getEphemeralPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      server.close(() => resolve(port));
    });
  });
}

export default defineConfig(async () => ({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.spec.ts"],
        },
      },
      {
        extends: ".storybook/vite.config.ts",
        plugins: [
          storybookTest({
            configDir: ".storybook",
            storybookScript: "pnpm run storybook",
          }),
        ],
        test: {
          name: "storybook",
          api: { port: await getEphemeralPort() },
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
}));
