"use client";

import { useMemo } from "react";
import * as rr from "react-router";

import { useNavigation } from "framework/client";

export const Outlet = rr.Outlet;
export const Route = rr.Route;

declare const BROWSER_ENVIRONMENT: boolean;

export function ClientRouter({
  loaderData,
  matches,
  rendered,
  url,
}: {
  loaderData: Record<string, unknown>;
  matches: { id: string; index?: boolean; path?: string }[];
  params: rr.Params<string>;
  rendered: Record<string, React.ReactNode>;
  url: string;
}) {
  const navigation = useNavigation();

  const navigator = BROWSER_ENVIRONMENT
    ? useMemo<rr.Navigator>(
        () => ({
          createHref(to) {
            console.log("CREATE", to);
            return new URL(typeof to === "string" ? to : rr.createPath(to), url)
              .href;
          },
          go(delta) {
            console.log("GO", delta);
            if (window.navigation) {
              if (delta === 0) {
                window.navigation.reload();
              } else if (delta > 0) {
                for (let i = 0; i < delta; i++) {
                  window.navigation.forward();
                }
              } else {
                for (let i = delta; i < 0; i++) {
                  window.navigation.back();
                }
              }
            } else {
              history.go(delta);
            }
          },
          push(to, state, opts) {
            console.log("PUSH", to);
            const newLocation = new URL(
              typeof to === "string" ? to : rr.createPath(to),
              url
            ).href;
            if (window.navigation) {
              window.navigation.navigate(newLocation, {
                history: "push",
                state,
              });
            } else {
              document.location.href = newLocation;
            }
          },
          replace(to, state, opts) {
            console.log("REPLACE", to);
          },
          encodeLocation(to) {
            console.log("ENCODE", to);
            return new URL(
              typeof to === "string" ? to : rr.createPath(to),
              url
            );
          },
        }),
        [url]
      )
    : useMemo<rr.Navigator>(
        () => ({
          createHref(to) {
            return new URL(typeof to === "string" ? to : rr.createPath(to), url)
              .href;
          },
          go(delta) {
            throw new Error("Not implemented");
          },
          push(to, state, opts) {
            throw new Error("Not implemented");
          },
          replace(to, state, opts) {
            throw new Error("Not implemented");
          },
          encodeLocation(to) {
            return new URL(
              typeof to === "string" ? to : rr.createPath(to),
              url
            );
          },
        }),
        [url]
      );

  let lastRoute: React.ReactNode | null = null;
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    if (!match) continue;
    lastRoute = (
      <Route
        element={rendered[match.id]}
        id={match.id}
        index={match.index as false}
        path={match.path}
      >
        {lastRoute}
      </Route>
    );
  }

  const fullUrl = new URL(url);

  return (
    <rr.UNSAFE_DataRouterStateContext.Provider
      value={{
        actionData: null,
        blockers: new Map(),
        errors: null,
        initialized: true,
        fetchers: new Map(),
        historyAction: rr.NavigationType.Push,
        loaderData,
        location: {
          hash: "",
          key: "default",
          pathname: fullUrl.pathname,
          search: fullUrl.search,
          state: null,
        },
        matches: matches as any[],
        navigation:
          navigation.state === "idle"
            ? {
                state: "idle",
                formAction: undefined,
                formData: undefined,
                formEncType: undefined,
                formMethod: undefined,
                json: undefined,
                location: undefined,
                text: undefined,
              }
            : {
                state: "loading",
                formAction: undefined,
                formData: undefined,
                formEncType: undefined,
                formMethod: undefined,
                json: undefined,
                location: {
                  hash: "",
                  key: "default",
                  pathname: navigation.to.pathname,
                  search: navigation.to.search,
                  state: null,
                },
                text: undefined,
              },
        preventScrollReset: false,
        restoreScrollPosition: false,
        revalidation: "idle",
      }}
    >
      <rr.Router
        location={fullUrl.pathname + fullUrl.search}
        navigator={navigator}
        // navigationType={rr.NavigationType.Push}
      >
        <rr.Routes>{lastRoute}</rr.Routes>
      </rr.Router>
    </rr.UNSAFE_DataRouterStateContext.Provider>
  );
}
