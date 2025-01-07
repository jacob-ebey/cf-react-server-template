import type { RouteObject } from "react-router";

import { matchRoutes } from "framework/react-router";
import { ClientRouter } from "framework/react-router.client";
import { getHeaders, getURL, waitToFlushUntil } from "framework/server";

import { GlobalPendingIndicator } from "./app.client";
import stylesHref from "./app.css?url";

import routes from "./routes";

export async function App() {
  const url = getURL();
  const headers = getHeaders();

  const { loadedRoutes, loaderData, matches } = await waitToFlushUntil(
    async () => {
      const matches = matchRoutes(routes, url.pathname + url.search);
      let loaderData = {};
      const loadRoutePromises: Promise<unknown>[] = [];
      if (matches?.length) {
        const request = new Request(url, { headers });

        // TODO: Call route actions

        loaderData = Object.fromEntries(
          await Promise.all(
            matches.map(async (match) => {
              const loadRoute = Promise.resolve(
                match.route.lazy?.() || match.route
              );
              loadRoutePromises.push(loadRoute);
              const route = await loadRoute;
              const loaderData =
                typeof route.loader === "function"
                  ? route.loader({
                      params: match.params,
                      request,
                      // context
                    })
                  : undefined;
              return [match.route.id, loaderData];
            })
          )
        );
      }

      return {
        matches,
        loadedRoutes: await Promise.all(loadRoutePromises),
        loaderData,
      };
    }
  );

  const rendered: Record<string, React.ReactNode> = {};
  for (let i = loadedRoutes.length - 1; i >= 0; i--) {
    const route = loadedRoutes[i] as RouteObject;
    const { id } = matches![i]!.route;
    if (!id) throw new Error("Route id is required");

    if (route.Component) {
      rendered[id] = <route.Component />;
    }
  }

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>React Server</title>
        <link rel="stylesheet" href={stylesHref} />
      </head>
      <body>
        <GlobalPendingIndicator />
        <ClientRouter
          loaderData={loaderData}
          params={matches?.[0]?.params ?? {}}
          rendered={rendered}
          matches={
            matches?.map((match) => ({
              id: match.route.id!,
              index: match.route.index,
              path: match.route.path,
            })) ?? []
          }
          url={url.href}
        />
      </body>
    </html>
  );
}
