import {
  createFromFetch,
  createFromReadableStream,
  // @ts-expect-error - no types yet
} from "@jacob-ebey/react-server-dom-vite/client";
import {
  startTransition,
  StrictMode,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { hydrateRoot } from "react-dom/client";
import { rscStream } from "rsc-html-stream/client";
// @ts-expect-error - no types yet
import { manifest } from "virtual:react-manifest";
import { api, callServer } from "./references.browser.js";
import type { UNSAFE_ServerPayload } from "./server.js";

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

function Shell(props: UNSAFE_ServerPayload) {
  const [{ location, root }, setPayload] = useState(props);
  api.updatePayload = setPayload;

  const windowLocation = useSyncExternalStore(
    locationSubscribe,
    getLocationSnapshot,
    () => location
  );

  useEffect(() => {
    if (location !== windowLocation) {
      window.history.replaceState(null, "", location);
    }
  }, [location, windowLocation]);

  return root;
}

export async function hydrateApp(container: Element | Document = document) {
  const payload: UNSAFE_ServerPayload = await createFromReadableStream(
    rscStream,
    manifest,
    { callServer }
  );

  startTransition(() => {
    hydrateRoot(
      container,
      <StrictMode>
        <Shell {...payload} />
      </StrictMode>,
      {
        formState: payload.formState,
      }
    );
  });

  window.navigation?.addEventListener("navigate", (event) => {
    if (
      !event.canIntercept ||
      event.defaultPrevented ||
      event.downloadRequest ||
      !event.userInitiated ||
      event.navigationType === "reload"
    ) {
      return;
    }

    event.intercept({
      async handler() {
        const abortController = new AbortController();
        let startedTransition = false;
        event.signal.addEventListener("abort", () => {
          if (startedTransition) return;
          abortController.abort();
        });
        const fetchPromise = fetch(event.destination.url, {
          body: event.formData,
          headers: {
            Accept: "text/x-component",
          },
          method: event.formData ? "POST" : "GET",
          signal: abortController.signal,
        });

        const payload: UNSAFE_ServerPayload = await createFromFetch(
          fetchPromise,
          manifest,
          { callServer }
        );

        startedTransition = true;
        startTransition(() => {
          api.updatePayload?.((existing) => ({ ...existing, ...payload }));
        });
      },
    });
  });
}
