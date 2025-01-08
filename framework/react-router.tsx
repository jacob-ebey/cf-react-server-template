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

  let cache = new Map<string, RouteObject>();
  const setupCache = (_routes: RouteObject[] = routes) => {
    for (const route of _routes) {
      cache.set(route.id!, route);
      if (route.children) {
        setupCache(route.children);
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
      params={matches?.[0]?.params ?? {}}
      rendered={rendered}
      matches={
        matches?.map((match) =>
          match.route.index
            ? {
                id: match.route.id!,
                index: match.route.index,
                path: match.route.path,
                pathname: match.pathname,
                pathnameBase: match.pathnameBase,
                hasAction: !!match.route.action,
                hasLoader: !!match.route.loader,
              }
            : {
                id: match.route.id!,
                path: match.route.path,
                pathname: match.pathname,
                pathnameBase: match.pathnameBase,
                hasAction: !!match.route.action,
                hasLoader: !!match.route.loader,
              }
        ) ?? []
      }
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
    let handlerUrl = new URL(request.url);
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
      let context = ctx;
      let headers = getDocumentHeaders(context);
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
        let results: { [key: string]: SingleFetchResult } = {};
        let loadedMatches = loadRouteIds
          ? context.matches.filter(
              (m) => m.route.loader && loadRouteIds!.includes(m.route.id)
            )
          : context.matches;

        loadedMatches.forEach((m) => {
          let { id } = m.route;
          if (context.errors && context.errors.hasOwnProperty(id)) {
            results[id] = { error: context.errors[id] };
          } else if (context.loaderData.hasOwnProperty(id)) {
            results[id] = { data: context.loaderData[id] };
          }
        });

        payload = {
          result: { data: results },
          headers,
          status: context.statusCode,
        };
      }
    }

    let { result, headers, status } = payload;
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
  let boundaryIdx = context.errors
    ? context.matches.findIndex((m) => context.errors![m.route.id])
    : -1;
  let matches =
    boundaryIdx >= 0
      ? context.matches.slice(0, boundaryIdx + 1)
      : context.matches;

  let errorHeaders: Headers | undefined;

  if (boundaryIdx >= 0) {
    // Look for any errorHeaders from the boundary route down, which can be
    // identified by the presence of headers but no data
    let { actionHeaders, actionData, loaderHeaders, loaderData } = context;
    context.matches.slice(boundaryIdx).some((match) => {
      let id = match.route.id;
      if (
        actionHeaders[id] &&
        (!actionData || !actionData.hasOwnProperty(id))
      ) {
        errorHeaders = actionHeaders[id];
      } else if (loaderHeaders[id] && !loaderData.hasOwnProperty(id)) {
        errorHeaders = loaderHeaders[id];
      }
      return errorHeaders != null;
    });
  }

  return matches.reduce((parentHeaders, match, idx) => {
    let { id } = match.route;
    let loaderHeaders = context.loaderHeaders[id] || new Headers();
    let actionHeaders = context.actionHeaders[id] || new Headers();

    // Only expose errorHeaders to the leaf headers() function to
    // avoid duplication via parentHeaders
    let includeErrorHeaders =
      errorHeaders != null && idx === matches.length - 1;
    // Only prepend cookies from errorHeaders at the leaf renderable route
    // when it's not the same as loaderHeaders/actionHeaders to avoid
    // duplicate cookies
    let includeErrorCookies =
      includeErrorHeaders &&
      errorHeaders !== loaderHeaders &&
      errorHeaders !== actionHeaders;

    let headers = new Headers(parentHeaders);
    if (includeErrorCookies) {
      prependCookies(errorHeaders!, headers);
    }
    prependCookies(actionHeaders, headers);
    prependCookies(loaderHeaders, headers);
    return headers;
  }, new Headers());
}
function prependCookies(parentHeaders: Headers, childHeaders: Headers): void {
  let parentSetCookieString = parentHeaders.get("Set-Cookie");

  if (parentSetCookieString) {
    let cookies = splitCookiesString(parentSetCookieString);
    cookies.forEach((cookie) => {
      childHeaders.append("Set-Cookie", cookie);
    });
  }
}

function getSingleFetchRedirect(
  status: number,
  headers: Headers,
  basename: string | undefined
): SingleFetchRedirectResult {
  let redirect = headers.get("Location")!;

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
  let startIndex = basename.endsWith("/")
    ? basename.length - 1
    : basename.length;
  let nextChar = pathname.charAt(startIndex);
  if (nextChar && nextChar !== "/") {
    // pathname does not start with basename/
    return null;
  }

  return pathname.slice(startIndex) || "/";
}

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
