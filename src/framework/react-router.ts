import type {
  ActionFunction,
  LazyRouteFunction,
  LoaderFunction,
  RouteObject,
} from "react-router";
import { randomId } from "~/lib/utils";

import { matchRoutes } from "../../react-router.rsc.js";

export { matchRoutes };

export type RouteConfig = RouteObject[];

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
    lazy: (async () => {
      const mod = await load();
      return {
        action: mod.action,
        index: true,
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
