import { createContext, use } from "react";

import type { Location } from "./server";

export type RouterContext = {
  location: Location;
  navigating: boolean;
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

export function useNavigating() {
  return routerContext().navigating;
}
