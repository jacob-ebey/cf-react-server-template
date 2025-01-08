import { createContext, use } from "react";

import type { Location } from "./server";

export type RouterContext = {
  location: Location;
  navigating: boolean;
  nextLocation?: Location;
};

export const UNSAFE_RouterContext = createContext<RouterContext | null>(null);

function routerContext() {
  const ctx = use(UNSAFE_RouterContext);
  if (!ctx) {
    throw new Error("No router context found");
  }
  return ctx;
}

export function useLocation() {
  return routerContext().location;
}

export function useNavigation() {
  const ctx = routerContext();

  if (ctx.navigating && ctx.nextLocation) {
    return {
      state: "navigating",
      to: ctx.nextLocation,
    } as const;
  }

  return {
    state: "idle",
    to: undefined,
  } as const;
}
