"use client";

// @ts-expect-error - no types yet
import { createFromReadableStream } from "@jacob-ebey/react-server-dom-vite/client";
import { useMemo } from "react";
import * as rr from "react-router";

// @ts-expect-error - no types yet
import { manifest } from "virtual:react-manifest";

export const Outlet = rr.Outlet;
export const Route = rr.Route;

declare const BROWSER_ENVIRONMENT: boolean;

export function isReactRouterDataRequest(url: URL) {
  return url.pathname.endsWith(".data");
}

export function ClientRouter({
  loaderData,
  matches,
  params,
  rendered,
  url,
}: {
  loaderData: Record<string, unknown>;
  matches:
    | {
        id: string;
        index?: boolean;
        path?: string;
        pathname: string;
        pathnameBase: string;
        hasAction: boolean;
        hasLoader: boolean;
      }[]
    | null;
  params: rr.Params<string>;
  rendered: Record<string, React.ReactNode>;
  url: string;
}) {
  const lastRoute = useMemo(() => {
    if (!matches?.length) return null;
    let lastRoute: rr.RouteObject | null = null;
    for (let i = matches.length - 1; i >= 0; i--) {
      const match = matches[i];
      if (!match) continue;
      lastRoute = {
        id: match.id,
        index: match.index,
        path: match.path,
        element: rendered[match.id],
        children: lastRoute ? [lastRoute] : undefined,
        action: match.hasAction,
        loader: match.hasLoader,
      } as rr.RouteObject;
    }
    return lastRoute;
  }, [matches, rendered]);

  const router = useMemo(() => {
    if (BROWSER_ENVIRONMENT) {
      return rr.createBrowserRouter(
        [
          lastRoute,
          {
            index: true,
            loader: true,
          },
          {
            path: "*",
            loader: true,
          },
        ].filter((r) => !!r),
        {
          hydrationData: {
            actionData: null,
            errors: null,
            loaderData,
          },
          async patchRoutesOnNavigation(args) {
            console.log("PATCH ROUTES", args);
          },
          dataStrategy({ request, matches, fetcherKey }) {
            if (request.method !== "GET") {
              return singleFetchActionStrategy(request, matches);
            }

            // Fetcher loads are singular calls to one loader
            if (fetcherKey) {
              return singleFetchLoaderFetcherStrategy(request, matches);
            }

            // Navigational loads are more complex...
            return singleFetchLoaderNavigationStrategy(
              router,
              request,
              matches
            );
          },
        }
      );
    }

    const fullUrl = new URL(url);
    return rr.UNSAFE_createRouter({
      history: {
        action: rr.NavigationType.Push,
        createHref(to) {
          const r = new URL(
            typeof to === "string" ? to : rr.createPath(to),
            url
          );
          return r.pathname + r.search;
        },
        createURL(to) {
          return new URL(typeof to === "string" ? to : rr.createPath(to), url);
        },
        encodeLocation(to) {
          return new URL(typeof to === "string" ? to : rr.createPath(to), url);
        },
        go() {
          throw new Error("Can not go before hydration");
        },
        listen() {
          throw new Error("Can not listen before hydration");
        },
        location: {
          hash: "",
          key: "default",
          pathname: fullUrl.pathname,
          search: fullUrl.search,
          state: null,
        },
        push() {
          throw new Error("Can not push before hydration");
        },
        replace() {
          throw new Error("Can not replace before hydration");
        },
      },
      hydrationData: {
        actionData: null,
        errors: null,
        loaderData,
      },
      routes: [lastRoute].filter((r) => !!r),
    });
  }, [lastRoute]);

  return <rr.RouterProvider router={router} />;
}

function singleFetchActionStrategy(
  request: Request,
  matches: rr.DataStrategyMatch[]
): never {
  throw new Error("Not implemented");
}

async function singleFetchLoaderFetcherStrategy(
  request: Request,
  matches: rr.DataStrategyMatch[]
) {
  let fetcherMatch = matches.find((m) => m.shouldLoad);
  if (!fetcherMatch) throw new Error("No fetcher match found");

  let result = await fetcherMatch.resolve(async (handler) => {
    let url = stripIndexParam(singleFetchUrl(request.url));
    let init = await createRequestInit(request);
    return fetchSingleLoader(handler, url, init, fetcherMatch!.route.id);
  });
  return { [fetcherMatch.route.id]: result };
}

async function singleFetchLoaderNavigationStrategy(
  router: rr.DataRouter,
  request: Request,
  matches: rr.DataStrategyMatch[]
) {
  // Track which routes need a server load - in case we need to tack on a
  // `_routes` param
  let routesParams = new Set<string>();

  // We only add `_routes` when one or more routes opts out of a load via
  // `shouldRevalidate` or `clientLoader`
  let foundOptOutRoute = false;

  // Deferreds for each route so we can be sure they've all loaded via
  // `match.resolve()`, and a singular promise that can tell us all routes
  // have been resolved
  let routeDfds = matches.map(() => createDeferred<void>());
  let routesLoadedPromise = Promise.all(routeDfds.map((d) => d.promise));

  // Deferred that we'll use for the call to the server that each match can
  // await and parse out it's specific result
  let singleFetchDfd = createDeferred<SingleFetchResults>();

  // Base URL and RequestInit for calls to the server
  let url = stripIndexParam(singleFetchUrl(request.url));
  let init = await createRequestInit(request);

  // We'll build up this results object as we loop through matches
  let results: Record<string, rr.DataStrategyResult> = {};

  let resolvePromise = Promise.all(
    matches.map(async (m, i) =>
      m.resolve(async (handler) => {
        routeDfds[i]!.resolve();

        let manifestRoute = manifest.routes[m.route.id];

        if (!m.shouldLoad) {
          // If we're not yet initialized and this is the initial load, respect
          // `shouldLoad` because we're only dealing with `clientLoader.hydrate`
          // routes which will fall into the `clientLoader` section below.
          if (!router.state.initialized) {
            return;
          }

          // Otherwise, we opt out if we currently have data, a `loader`, and a
          // `shouldRevalidate` function.  This implies that the user opted out
          // via `shouldRevalidate`
          if (
            m.route.id in router.state.loaderData &&
            manifestRoute &&
            manifestRoute.hasLoader
            // &&
            // TODO: Load module and check if it has a `shouldRevalidate` function
            // routeModules[m.route.id]?.shouldRevalidate
          ) {
            foundOptOutRoute = true;
            return;
          }
        }

        // When a route has a client loader, it opts out of the singular call and
        // calls it's server loader via `serverLoader()` using a `?_routes` param
        if (manifestRoute && manifestRoute.hasClientLoader) {
          if (manifestRoute.hasLoader) {
            foundOptOutRoute = true;
          }
          try {
            let result = await fetchSingleLoader(
              handler,
              url,
              init,
              m.route.id
            );
            results[m.route.id] = { type: "data", result };
          } catch (e) {
            results[m.route.id] = { type: "error", result: e };
          }
          return;
        }

        // Load this route on the server if it has a loader
        if (manifestRoute && manifestRoute.hasLoader) {
          routesParams.add(m.route.id);
        }

        // Lump this match in with the others on a singular promise
        try {
          let result = await handler(async () => {
            let data = await singleFetchDfd.promise;
            return unwrapSingleFetchResults(data, m.route.id);
          });
          results[m.route.id] = {
            type: "data",
            result,
          };
        } catch (e) {
          results[m.route.id] = {
            type: "error",
            result: e,
          };
        }
      })
    )
  );

  // Wait for all routes to resolve above before we make the HTTP call
  await routesLoadedPromise;

  try {
    // When one or more routes have opted out, we add a _routes param to
    // limit the loaders to those that have a server loader and did not
    // opt out
    if (foundOptOutRoute && routesParams.size > 0) {
      url.searchParams.set(
        "_routes",
        matches
          .filter((m) => routesParams.has(m.route.id))
          .map((m) => m.route.id)
          .join(",")
      );
    }

    let data = await fetchAndDecode(url, init);
    singleFetchDfd.resolve(data.data as SingleFetchResults);
  } catch (e) {
    singleFetchDfd.reject(e as Error);
  }

  await resolvePromise;

  return results;
}

export function singleFetchUrl(reqUrl: URL | string) {
  let url =
    typeof reqUrl === "string"
      ? new URL(
          reqUrl,
          // This can be called during the SSR flow via PrefetchPageLinksImpl so
          // don't assume window is available
          typeof window === "undefined"
            ? "server://singlefetch/"
            : window.location.origin
        )
      : reqUrl;

  if (url.pathname === "/") {
    url.pathname = "_root.data";
  } else {
    url.pathname = `${url.pathname.replace(/\/$/, "")}.data`;
  }

  return url;
}

function stripIndexParam(url: URL) {
  let indexValues = url.searchParams.getAll("index");
  url.searchParams.delete("index");
  let indexValuesToKeep = [];
  for (let indexValue of indexValues) {
    if (indexValue) {
      indexValuesToKeep.push(indexValue);
    }
  }
  for (let toKeep of indexValuesToKeep) {
    url.searchParams.append("index", toKeep);
  }

  return url;
}

async function createRequestInit(request: Request): Promise<RequestInit> {
  let init: RequestInit = { signal: request.signal };

  if (request.method !== "GET") {
    init.method = request.method;

    let contentType = request.headers.get("Content-Type");

    // Check between word boundaries instead of startsWith() due to the last
    // paragraph of https://httpwg.org/specs/rfc9110.html#field.content-type
    if (contentType && /\bapplication\/json\b/.test(contentType)) {
      init.headers = { "Content-Type": contentType };
      init.body = JSON.stringify(await request.json());
    } else if (contentType && /\btext\/plain\b/.test(contentType)) {
      init.headers = { "Content-Type": contentType };
      init.body = await request.text();
    } else if (
      contentType &&
      /\bapplication\/x-www-form-urlencoded\b/.test(contentType)
    ) {
      init.body = new URLSearchParams(await request.text());
    } else {
      init.body = await request.formData();
    }
  }

  return init;
}

async function fetchSingleLoader(
  handler: Parameters<
    NonNullable<Parameters<rr.DataStrategyMatch["resolve"]>[0]>
  >[0],
  url: URL,
  init: RequestInit,
  routeId: string
) {
  // return handler(async () => {
  let singleLoaderUrl = new URL(url);
  singleLoaderUrl.searchParams.set("_routes", routeId);
  let { data } = await fetchAndDecode(singleLoaderUrl, init);
  return unwrapSingleFetchResults(data as SingleFetchResults, routeId);
  // });
}

async function fetchAndDecode(url: URL, init: RequestInit) {
  const referencePromise = import("./references.browser");
  let res = await fetch(url, init);

  // If this 404'd without hitting the running server (most likely in a
  // pre-rendered app using a CDN), then bubble a standard 404 ErrorResponse
  if (res.status === 404 && !res.headers.has("X-Remix-Response")) {
    throw new rr.UNSAFE_ErrorResponseImpl(404, "Not Found", true);
  }

  if (!res.body) throw new Error("No response body to decode");

  const { callServer } = await referencePromise;
  try {
    let decoded = await createFromReadableStream(res.body, manifest, {
      callServer,
    });
    return { status: res.status, data: decoded };
  } catch (e) {
    // Can't clone after consuming the body via RSC stream so we can't
    // include the body here. In an ideal world we'd look for a turbo-stream
    // content type here, or even X-Remix-Response but then folks can't
    // statically deploy their prerendered .data files to a CDN unless they can
    // tell that CDN to add special headers to those certain files - which is a
    // bit restrictive.
    throw new Error("Unable to decode RSC response");
  }
}

export type SingleFetchRedirectResult = {
  redirect: string;
  status: number;
  revalidate: boolean;
  reload: boolean;
  replace: boolean;
};

export type SingleFetchResult =
  | { data: unknown }
  | { error: unknown }
  | SingleFetchRedirectResult;

export type SingleFetchResults =
  | {
      data: { [key: string]: SingleFetchResult };
    }
  | {
      redirect: SingleFetchRedirectResult;
    };

function unwrapSingleFetchResults(
  results: SingleFetchResults,
  routeId: string
) {
  if ("redirect" in results) {
    return unwrapSingleFetchResult(results.redirect, routeId);
  }

  return results.data[routeId] !== undefined
    ? unwrapSingleFetchResult(results.data[routeId], routeId)
    : null;
}

function unwrapSingleFetchResult(result: SingleFetchResult, routeId: string) {
  if ("error" in result) {
    throw result.error;
  } else if ("redirect" in result) {
    let headers: Record<string, string> = {};
    if (result.revalidate) {
      headers["X-Remix-Revalidate"] = "yes";
    }
    if (result.reload) {
      headers["X-Remix-Reload-Document"] = "yes";
    }
    if (result.replace) {
      headers["X-Remix-Replace"] = "yes";
    }
    throw rr.redirect(result.redirect, { status: result.status, headers });
  } else if ("data" in result) {
    return result.data;
  } else {
    throw new Error(`No response found for routeId "${routeId}"`);
  }
}

function createDeferred<T = unknown>() {
  let resolve: (val?: any) => Promise<void>;
  let reject: (error?: Error) => Promise<void>;
  let promise = new Promise<T>((res, rej) => {
    resolve = async (val: T) => {
      res(val);
      try {
        await promise;
      } catch (e) {}
    };
    reject = async (error?: Error) => {
      rej(error);
      try {
        await promise;
      } catch (e) {}
    };
  });
  return {
    promise,
    //@ts-ignore
    resolve,
    //@ts-ignore
    reject,
  };
}
