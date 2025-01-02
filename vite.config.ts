import * as path from "node:path";

import { cloudflare } from "@flarelabs-net/vite-plugin-cloudflare";
import reactServerDOM from "@jacob-ebey/vite-react-server-dom";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  environments: {
    client: {
      build: {
        rollupOptions: {
          input: "src/browser/entry.browser.tsx",
        },
      },
    },
  },
  plugins: [
    tsconfigPaths({ configNames: ["tsconfig.client.json"] }),
    reactServerDOM({
      browserEnvironment: "client",
      serverEnvironments: ["server"],
      ssrEnvironments: ["ssr"],
      runtime: {
        browser: {
          importFrom: path.resolve("src/framework/references.browser.ts"),
        },
        server: {
          importFrom: path.resolve("src/framework/references.server.ts"),
        },
        ssr: {
          importFrom: path.resolve("src/framework/references.ssr.ts"),
        },
      },
    }),
    cloudflare({
      persistState: false,
      configPath: "src/ssr/wrangler.toml",
      auxiliaryWorkers: [
        {
          configPath: "src/server/wrangler.toml",
        },
      ],
    }),
  ],
});
