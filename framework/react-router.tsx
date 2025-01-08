import * as stream from "node:stream";

// @ts-expect-error - no types yet
import RSD from "@jacob-ebey/react-server-dom-vite/server";
import type {
  ActionFunction,
  LazyRouteFunction,
  LoaderFunction,
  RouteObject,
  DataRouteMatch,
  StaticHandlerContext,
} from "react-router";
import { createStaticHandler, matchRoutes } from "react-router";
import { splitCookiesString } from "set-cookie-parser";

import type {
  RouteManifest,
  RoutesManifest,
  SingleFetchRedirectResult,
  SingleFetchResult,
  SingleFetchResults,
} from "framework/react-router.client";
import { ClientRouter } from "framework/react-router.client";
import {
  getHeaders,
  getURL,
  redirect,
  waitToFlushUntil,
} from "framework/server";
// @ts-expect-error - no types yet
import { manifest } from "virtual:react-manifest";

export { matchRoutes };

export async function ServerRouter({ routes }: { routes: RouteConfig }) {
  const url = getURL();
  const headers = getHeaders();

  const result = await waitToFlushUntil(
    async (): Promise<
      | {
          redirect: true;
        }
      | {
          redirect: false;
          loaderData: Record<string, unknown>;
          matches: DataRouteMatch[];
        }
    > => {
      const handler = createStaticHandler(routes);
      // TODO: Handle POST requests
      const context = await handler.query(new Request(url, { headers }));
      if (isResponse(context)) {
        const location = context.headers.get("Location");
        if (!location || !isRedirectStatusCode(context.status)) {
          throw new Error("Invalid response");
        }
        redirect(location, context.status);
        return { redirect: true };
      }

      return {
        matches: context.matches,
        loaderData: context.loaderData,
        redirect: false,
      };
    }
  );

  if (result.redirect) {
    return;
  }

  const { loaderData, matches } = result;

  const routesManifest: RoutesManifest = [];
  const cache = new Map<string, RouteObject>();
  const setupCache = (
    _routes: RouteObject[] = routes,
    _routesManifest: RoutesManifest = routesManifest
  ) => {
    for (const route of _routes) {
      if (!route.id) throw new Error("Route id is required");

      const manifest: RouteManifest = {
        id: route.id,
        index: route.index,
        path: route.path,
        clientModule: undefined,
        hasAction: !!route.action,
        hasClientAction: false,
        hasClientLoader: false,
        hasLoader: !!route.loader,
      };
      _routesManifest.push(manifest);

      cache.set(route.id, route);
      if (route.children) {
        manifest.children = [];
        setupCache(route.children, manifest.children);
      }
    }
  };
  setupCache();

  const rendered: Record<string, React.ReactNode> = {};
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];

    if (!match?.route.id) throw new Error("Route id is required");
    const route = cache.get(match.route.id);
    if (!route) throw new Error("Route not found");

    if (route.Component) {
      rendered[match.route.id] = <route.Component />;
    }
  }

  return (
    <ClientRouter
      loaderData={loaderData}
      rendered={rendered}
      routesManifest={routesManifest}
      url={url.href}
    />
  );
}

const SINGLE_FETCH_REDIRECT_STATUS = 202;

export async function handleReactRouterRequest(
  request: Request,
  routes: RouteObject[]
) {
  const url = new URL(request.url);

  if (url.pathname.endsWith(".data")) {
    const handlerUrl = new URL(request.url);
    handlerUrl.pathname = handlerUrl.pathname
      .replace(/\.data$/, "")
      .replace(/^\/_root$/, "/");

    const matches = matchRoutes(
      routes,
      handlerUrl.pathname + handlerUrl.search
    );

    if (!matches?.length) {
      return new Response("Not found", { status: 404 });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      // TODO: Handle POST requests
      throw new Error("Not implemented");
    }

    const handler = createStaticHandler(routes);
    const ctx = await handler.query(
      new Request(handlerUrl, {
        headers: request.headers,
        signal: request.signal,
        body:
          request.method !== "GET" && request.method !== "HEAD"
            ? request.body
            : undefined,
        duplex:
          request.method !== "GET" && request.method !== "HEAD"
            ? "half"
            : undefined,
      } as RequestInit)
    );
    let payload: {
      headers: Headers;
      result: SingleFetchResults;
      status: number;
    };
    if (isResponse(ctx)) {
      payload = {
        result: {
          redirect: getSingleFetchRedirect(ctx.status, ctx.headers, undefined),
        },
        headers: ctx.headers,
        status: SINGLE_FETCH_REDIRECT_STATUS,
      };
    } else {
      const context = ctx;
      const headers = getDocumentHeaders(context);
      // let headers = new Headers();

      if (isRedirectStatusCode(context.statusCode) && headers.has("Location")) {
        payload = {
          result: {
            redirect: getSingleFetchRedirect(
              context.statusCode,
              headers,
              undefined
            ),
          },
          headers,
          status: SINGLE_FETCH_REDIRECT_STATUS,
        };
      } else {
        const loadRouteIds = matches.map((m) => m.route.id);
        // Aggregate results based on the matches we intended to load since we get
        // `null` values back in `context.loaderData` for routes we didn't load
        const results: { [key: string]: SingleFetchResult } = {};
        const loadedMatches = loadRouteIds
          ? context.matches.filter(
              (m) => m.route.loader && loadRouteIds.includes(m.route.id)
            )
          : context.matches;

        for (const match of loadedMatches) {
          const { id } = match.route;
          if (context.errors && id in context.errors) {
            results[id] = { error: context.errors[id] };
          } else if (context.loaderData && id in context.loaderData) {
            results[id] = { data: context.loaderData[id] };
          }
        }

        const routesManifest: RoutesManifest = [];
        const cache = new Map<string, RouteObject>();
        const setupCache = (
          _routes: RouteObject[] = routes,
          _routesManifest: RoutesManifest = routesManifest
        ) => {
          for (const route of _routes) {
            if (!route.id) throw new Error("Route id is required");

            const manifest: RouteManifest = {
              id: route.id,
              index: route.index,
              path: route.path,
              clientModule: undefined,
              hasAction: !!route.action,
              hasClientAction: false,
              hasClientLoader: false,
              hasLoader: !!route.loader,
            };
            _routesManifest.push(manifest);

            cache.set(route.id, route);
            if (route.children) {
              manifest.children = [];
              setupCache(route.children, manifest.children);
            }
          }
        };
        setupCache();

        const rendered: Record<string, React.ReactNode> = {};
        for (let i = matches.length - 1; i >= 0; i--) {
          const match = matches[i];

          if (!match?.route.id) throw new Error("Route id is required");
          const route = cache.get(match.route.id);
          if (!route) throw new Error("Route not found");

          if (route.Component) {
            rendered[match.route.id] = <route.Component />;
          }
        }

        payload = {
          result: { data: results, rendered },
          headers,
          status: context.statusCode,
        };
      }
    }

    const { result, headers, status } = payload;
    headers.set("Content-Type", "text/x-component");
    const { abort, pipe } = RSD.renderToPipeableStream(result, manifest);
    request.signal.addEventListener("abort", () => abort());
    const body = stream.Readable.toWeb(
      pipe(new stream.PassThrough())
    ) as ReadableStream<Uint8Array>;

    return new Response(body, {
      status,
      headers,
    });
  }
}

function getDocumentHeaders(context: StaticHandlerContext): Headers {
  const errors = context.errors;
  const boundaryIdx = errors
    ? context.matches.findIndex((m) => errors[m.route.id])
    : -1;
  const matches =
    boundaryIdx >= 0
      ? context.matches.slice(0, boundaryIdx + 1)
      : context.matches;

  let errorHeaders: Headers | undefined;

  if (boundaryIdx >= 0) {
    // Look for any errorHeaders from the boundary route down, which can be
    // identified by the presence of headers but no data
    const { actionHeaders, actionData, loaderHeaders, loaderData } = context;
    context.matches.slice(boundaryIdx).some((match) => {
      const id = match.route.id;
      if (actionHeaders[id] && (!actionData || !(id in actionData))) {
        errorHeaders = actionHeaders[id];
      } else if (loaderHeaders[id] && !(id in loaderData)) {
        errorHeaders = loaderHeaders[id];
      }
      return errorHeaders != null;
    });
  }

  return matches.reduce((parentHeaders, match, idx) => {
    const { id } = match.route;
    const loaderHeaders = context.loaderHeaders[id] || new Headers();
    const actionHeaders = context.actionHeaders[id] || new Headers();

    // Only expose errorHeaders to the leaf headers() function to
    // avoid duplication via parentHeaders
    const includeErrorHeaders =
      errorHeaders != null && idx === matches.length - 1;
    // Only prepend cookies from errorHeaders at the leaf renderable route
    // when it's not the same as loaderHeaders/actionHeaders to avoid
    // duplicate cookies
    const includeErrorCookies =
      includeErrorHeaders &&
      errorHeaders !== loaderHeaders &&
      errorHeaders !== actionHeaders;

    const headers = new Headers(parentHeaders);
    if (includeErrorCookies && errorHeaders) {
      prependCookies(errorHeaders, headers);
    }
    prependCookies(actionHeaders, headers);
    prependCookies(loaderHeaders, headers);
    return headers;
  }, new Headers());
}
function prependCookies(parentHeaders: Headers, childHeaders: Headers): void {
  const parentSetCookieString = parentHeaders.get("Set-Cookie");

  if (parentSetCookieString) {
    const cookies = splitCookiesString(parentSetCookieString);
    for (const cookie of cookies) {
      childHeaders.append("Set-Cookie", cookie);
    }
  }
}

function getSingleFetchRedirect(
  status: number,
  headers: Headers,
  basename: string | undefined
): SingleFetchRedirectResult {
  let redirect = headers.get("Location");

  if (!redirect) {
    throw new Error("Expected redirect location");
  }

  if (basename) {
    redirect = stripBasename(redirect, basename) || redirect;
  }

  return {
    redirect,
    status,
    revalidate:
      // Technically X-Remix-Revalidate isn't needed here - that was an implementation
      // detail of ?_data requests as our way to tell the front end to revalidate when
      // we didn't have a response body to include that information in.
      // With single fetch, we tell the front end via this revalidate boolean field.
      // However, we're respecting it for now because it may be something folks have
      // used in their own responses
      // TODO(v3): Consider removing or making this official public API
      headers.has("X-Remix-Revalidate") || headers.has("Set-Cookie"),
    reload: headers.has("X-Remix-Reload-Document"),
    replace: headers.has("X-Remix-Replace"),
  };
}
function stripBasename(pathname: string, basename: string): string | null {
  if (basename === "/") return pathname;

  if (!pathname.toLowerCase().startsWith(basename.toLowerCase())) {
    return null;
  }

  // We want to leave trailing slash behavior in the user's control, so if they
  // specify a basename with a trailing slash, we should support it
  const startIndex = basename.endsWith("/")
    ? basename.length - 1
    : basename.length;
  const nextChar = pathname.charAt(startIndex);
  if (nextChar && nextChar !== "/") {
    // pathname does not start with basename/
    return null;
  }

  return pathname.slice(startIndex) || "/";
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
function isResponse(value: any): value is Response {
  return (
    value != null &&
    typeof value.status === "number" &&
    typeof value.statusText === "string" &&
    typeof value.headers === "object" &&
    typeof value.body !== "undefined"
  );
}

const redirectStatusCodes = new Set([301, 302, 303, 307, 308]);
function isRedirectStatusCode(statusCode: number): boolean {
  return redirectStatusCodes.has(statusCode);
}

//--------------------------------------------------------------------
// route config
//--------------------------------------------------------------------

export type RouteConfig = RouteObject[];

function randomId() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

export function index(
  load: () => Promise<{
    action?: ActionFunction;
    Component?: React.ComponentType;
    ErrorBoundary?: React.ComponentType;
    loader?: LoaderFunction;
  }>,
  { id }: { id?: string } = {}
): RouteObject {
  const route = {
    id: id || randomId(),
    index: true,
    lazy: (async () => {
      const mod = await load();
      route.action = mod.action;
      route.Component = mod.Component;
      route.ErrorBoundary = mod.ErrorBoundary ?? null;
      route.loader = mod.loader;
      route.lazy = undefined;
      return {
        action: mod.action,
        Component: mod.Component,
        ErrorBoundary: mod.ErrorBoundary ?? null,
        loader: mod.loader,
      };
    }) satisfies LazyRouteFunction<RouteObject>,
  } as RouteObject;
  return route;
}

export function route(
  path: string,
  load: () => Promise<{
    action?: ActionFunction;
    Component?: React.ComponentType;
    ErrorBoundary?: React.ComponentType;
    loader?: LoaderFunction;
  }>,
  { children, id }: { children?: RouteObject[]; id?: string } = {}
): RouteObject {
  const route = {
    id: id || randomId(),
    path,
    children,
    lazy: (async () => {
      const mod = await load();
      route.action = mod.action;
      route.Component = mod.Component;
      route.ErrorBoundary = mod.ErrorBoundary ?? null;
      route.loader = mod.loader;
      route.lazy = undefined;
      return {
        action: mod.action,
        Component: mod.Component,
        ErrorBoundary: mod.ErrorBoundary ?? null,
        loader: mod.loader,
      };
    }) satisfies LazyRouteFunction<RouteObject>,
  } as RouteObject;
  return route;
}
