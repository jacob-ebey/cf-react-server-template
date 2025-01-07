import {
  createFromFetch,
  createFromReadableStream,
  // @ts-expect-error - no types yet
} from "@jacob-ebey/react-server-dom-vite/client";
import {
  startTransition,
  StrictMode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useOptimistic,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { hydrateRoot } from "react-dom/client";
import { rscStream } from "rsc-html-stream/client";
// @ts-expect-error - no types yet
import { manifest } from "virtual:react-manifest";

import { UNSAFE_RouterContext, type RouterContext } from "./client.js";
import { api, callServer } from "./references.browser.js";
import type { Location, UNSAFE_ServerPayload } from "./server.js";

function getLocationSnapshot() {
  return window.location.pathname + window.location.search;
}

function locationSubscribe(callback: () => void) {
  if (window.navigation) {
    window.navigation.addEventListener("navigate", callback);
    return () => {
      window.navigation.removeEventListener("navigate", callback);
    };
  }

  let current = window.location.href;
  let aborted = false;
  const interval = setInterval(() => {
    if (current !== window.location.href && !aborted) {
      current = window.location.href;
      callback();
    }
  }, 500);
  return () => {
    aborted = true;
    clearInterval(interval);
  };
}

function Shell({ payload }: { payload: Promise<UNSAFE_ServerPayload> }) {
  const [promise, setPayload] = useState(payload);
  const [navigating, startNavigation] = useTransition();
  const [nextLocation, setNextLocation] = useState<Location | undefined>(
    undefined
  );

  const { location, root } = use(promise);

  api.updatePayload = useCallback<
    React.Dispatch<React.SetStateAction<Promise<UNSAFE_ServerPayload>>>
  >((payload) => {
    startNavigation(() => {
      setPayload(payload);
    });
  }, []);

  const windowLocation = useSyncExternalStore(
    locationSubscribe,
    getLocationSnapshot,
    () => location.pathname + location.search
  );

  useEffect(() => {
    if (!navigating && location.pathname + location.search !== windowLocation) {
      window.history.replaceState(
        null,
        "",
        location.pathname + location.search
      );
    }
  }, [location, windowLocation, navigating]);

  useEffect(() => {
    const handler = (event: NavigateEvent) => {
      if (
        !event.canIntercept ||
        event.defaultPrevented ||
        event.downloadRequest ||
        event.navigationType === "reload"
      ) {
        return;
      }

      const url = new URL(event.destination.url);

      if (url.origin !== window.location.origin) {
        return;
      }

      setNextLocation({
        pathname: url.pathname,
        search: url.search,
      });

      event.intercept({
        async handler() {
          const abortController = new AbortController();
          let startedTransition = false;
          event.signal.addEventListener("abort", () => {
            if (startedTransition) return;
            abortController.abort();
          });
          const fetchPromise = fetch(url, {
            body: event.formData,
            headers: {
              Accept: "text/x-component",
            },
            method: event.formData ? "POST" : "GET",
            signal: abortController.signal,
          });

          const payloadPromise: UNSAFE_ServerPayload = createFromFetch(
            fetchPromise,
            manifest,
            { callServer }
          );

          api.updatePayload?.((promise) => {
            startedTransition = true;
            return Promise.all([promise, payloadPromise]).then(
              ([existing, payload]) => ({
                ...existing,
                ...payload,
              })
            );
          });
        },
      });
    };
    window.navigation?.addEventListener("navigate", handler);
    return () => {
      window.navigation?.removeEventListener("navigate", handler);
    };
  });

  const routerContext = useMemo<RouterContext>(
    () => ({ location, navigating, nextLocation }),
    [location, navigating, nextLocation]
  );

  return (
    <UNSAFE_RouterContext.Provider value={routerContext}>
      {root}
    </UNSAFE_RouterContext.Provider>
  );
}

export function hydrateApp(container: Element | Document = document) {
  const payload: Promise<UNSAFE_ServerPayload> = createFromReadableStream(
    rscStream,
    manifest,
    { callServer }
  );

  startTransition(async () => {
    hydrateRoot(
      container,
      <StrictMode>
        <Shell payload={payload} />
      </StrictMode>,
      {
        formState: (await payload).formState,
      }
    );
  });
}
