import {
  createFromFetch,
  createServerReference as createServerReferenceImp,
  encodeReply,
  // @ts-expect-error - no types yet
} from "@jacob-ebey/react-server-dom-vite/client";
import { startTransition } from "react";
// @ts-expect-error - no types yet
import { manifest } from "virtual:react-manifest";
import type { UNSAFE_ServerPayload } from "./server";

export const api: {
  updatePayload?: React.Dispatch<React.SetStateAction<UNSAFE_ServerPayload>>;
} = {};

export async function callServer(id: string, args: unknown) {
  const fetchPromise = fetch(
    new Request(window.location.href, {
      method: "POST",
      headers: {
        Accept: "text/x-component",
        "rsc-action": id,
      },
      body: await encodeReply(args),
    })
  );

  const payload: UNSAFE_ServerPayload = await createFromFetch(
    fetchPromise,
    manifest,
    {
      callServer,
    }
  );

  startTransition(() => {
    api.updatePayload?.((existing) => ({ ...existing, ...payload }));
  });

  return payload.returnValue;
}

export function createServerReference(imp: unknown, id: string, name: string) {
  return createServerReferenceImp(`${id}#${name}`, callServer);
}
