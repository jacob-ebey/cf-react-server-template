import { spawnSync } from "node:child_process";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import { cloudflare } from "@flarelabs-net/vite-plugin-cloudflare";
import reactServerDOM from "@jacob-ebey/vite-react-server-dom";
import type { RouteConfig } from "@react-router/dev/routes";
import type * as vite from "vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

import { generate, parse } from "./babel";
import { removeExports } from "./remove-exports";

export default defineConfig({
  environments: {
    client: {
      build: {
        rollupOptions: {
          input: "src/browser/entry.browser.tsx",
        },
      },
      define: {
        BROWSER_ENVIRONMENT: true,
      },
    },
    ssr: {
      define: {
        BROWSER_ENVIRONMENT: false,
      },
    },
  },
  plugins: [
    tsconfigPaths({ configNames: ["tsconfig.client.json"] }),
    // reactRouterServer({
    //   routes: "src/app/routes.ts",
    // }),
    reactServerDOM({
      browserEnvironment: "client",
      serverEnvironments: ["server"],
      ssrEnvironments: ["ssr"],
      runtime: {
        browser: {
          importFrom: "framework/references.browser",
        },
        server: {
          importFrom: "framework/references.server",
        },
        ssr: {
          importFrom: "framework/references.ssr",
        },
      },
    }),
    cloudflare({
      persistState: true,
      configPath: "src/ssr/wrangler.toml",
      auxiliaryWorkers: [
        {
          configPath: "src/server/wrangler.toml",
        },
      ],
    }),
  ],
});

// const SERVER_ONLY_ROUTE_EXPORTS = ["loader", "action", "headers"];
// const CLIENT_ROUTE_EXPORTS = [
//   "clientAction",
//   "clientLoader",
//   "default",
//   "ErrorBoundary",
//   "handle",
//   "HydrateFallback",
//   "Layout",
//   "links",
//   "meta",
//   "shouldRevalidate",
// ];

// function reactRouterServer({ routes }: { routes: string }): vite.Plugin {
//   const routesPath = path.resolve(routes);
//   const routesConfig = loadRoutesConfig(routesPath);
//   const routeFiles = collectRoutes(path.dirname(routesPath), routesConfig);

//   // TODO: Store the "client" portion of the route module
//   const vmods = new Map<string, string>();

//   return {
//     name: "react-router-server",
//     resolveId(id) {
//       // TODO: Resolve "virtual:react-router/routes"
//       // TODO: Resolve "virtual:react-router/client-route/${id}"
//     },
//     load(id) {
//       // TODO: Resolve "virtual:react-router/routes" with runtime version of routes.ts
//       // TODO: Resolve "virtual:react-router/client-route/${id}" with vmod content
//     },
//     transform(code, id) {
//       if (routeFiles.has(id)) {
//         let clientAST = parse(code, { sourceType: "module" });

//         let transformed = "";

//         // client: remove server exports
//         const removedExports = removeExports(
//           structuredClone(clientAST),
//           CLIENT_ROUTE_EXPORTS
//         );

//         let result = generate(clientAST, {
//           sourceMaps: true,
//           filename: id,
//           sourceFileName: id,
//         });
//         // server: remove client exports
//         const serverRemovedExports = removeExports(ast, CLIENT_ROUTE_EXPORTS);
//         if (serverRemovedExports.has("default")) {
//           const vmodId = `virtual:react-router/client-route/${id}`;
//           const reexport = `export { default } from "${vmodId}";\n`;
//           result.code = reexport + result.code;
//         }
//         // NOTE: we messed up sourcemaps by just adding re-export to beginning. fix this later
//         return result;

//         // TODO: Strip out the "client" portion of the route.
//         // - If there was no client portion, return the og code
//         // - If there was a client portion, strip it and store the
//         //    client portion in the vmods map with a re-export to that vmod
//       }
//     },
//   };
// }

// function collectRoutes(
//   base: string,
//   routes: Awaited<RouteConfig>,
//   collected = new Set<string>()
// ) {
//   for (const route of routes) {
//     collected.add(path.resolve(base, route.file));

//     if (route.children) {
//       collectRoutes(base, route.children, collected);
//     }
//   }
//   return collected;
// }

// function loadRoutesConfig(file: string): Awaited<RouteConfig> {
//   const toLoad = pathToFileURL(file).href;
//   const script = `(async () => {
//     const mod = await import(${JSON.stringify(toLoad)});
//     console.log(JSON.stringify(await mod.default));
//   })()`;

//   const { stdout, status } = spawnSync("node", [
//     "--experimental-strip-types",
//     "-e",
//     script,
//   ]);
//   if (status !== 0) {
//     throw new Error("Failed to load routes config");
//   }
//   const config = JSON.parse(stdout.toString());
//   return config;
// }
