import * as stream from "node:stream";

// @ts-expect-error - no types yet
import RSD from "@jacob-ebey/react-server-dom-vite/server";
import type {
  ActionFunction,
  LazyRouteFunction,
  LoaderFunction,
  RouteObject,
  StaticHandlerContext,
} from "react-router";
import { splitCookiesString } from "set-cookie-parser";

import type {
  SingleFetchRedirectResult,
  SingleFetchResult,
  SingleFetchResults,
} from "framework/react-router.client";
import { ClientRouter } from "framework/react-router.client";
import { getHeaders, getURL, waitToFlushUntil } from "framework/server";
// @ts-expect-error - no types yet
import { manifest } from "virtual:react-manifest";

import { createStaticHandler, matchRoutes } from "../react-router.rsc.js";

export { matchRoutes };

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
  return {
    id: id || randomId(),
    index: true,
    // action: true,
    // loader: true,
    lazy: (async () => {
      const mod = await load();
      return {
        action: mod.action,
        // index: true,
        Component: mod.Component,
        ErrorBoundary: mod.ErrorBoundary ?? null,
        loader: mod.loader,
      };
    }) satisfies LazyRouteFunction<RouteObject>,
  };
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
  return {
    id: id || randomId(),
    path,
    children,
    // action: true,
    // loader: true,
    lazy: (async () => {
      const mod = await load();
      return {
        action: mod.action,
        Component: mod.Component,
        ErrorBoundary: mod.ErrorBoundary ?? null,
        loader: mod.loader,
      };
    }) satisfies LazyRouteFunction<RouteObject>,
  };
}

export async function ServerRouter({ routes }: { routes: RouteConfig }) {
  const url = getURL();
  const headers = getHeaders();

  const { loadedRoutes, loaderData, matches, hasLoaders } =
    await waitToFlushUntil(async () => {
      const matches = matchRoutes(routes, url.pathname + url.search);
      let loaderData = {};
      let hasLoaders: Record<string, boolean> = {};
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
              hasLoaders[match.route.id!] = !!route.loader;
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
        hasLoaders,
      };
    });

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
                hasAction: hasLoaders[match.route.id!]!,
                hasLoader: hasLoaders[match.route.id!]!,
              }
            : {
                id: match.route.id!,
                path: match.route.path,
                pathname: match.pathname,
                pathnameBase: match.pathnameBase,
                hasAction: hasLoaders[match.route.id!]!,
                hasLoader: hasLoaders[match.route.id!]!,
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
