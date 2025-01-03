import { AsyncLocalStorage } from "node:async_hooks";
import * as stream from "node:stream";
// @ts-expect-error - no types yet
import RSD from "@jacob-ebey/react-server-dom-vite/server";
// @ts-expect-error - no types yet
import { manifest } from "virtual:react-manifest";
import type React from "react";
import type { ReactFormState } from "react-dom/client";

import {
  createCookieSessionStorage,
  type CookieSessionStorageOptions,
} from "./cookie-session";
import type { Session, SessionData } from "./sessions";

export type UNSAFE_ServerPayload = {
  formState?: ReactFormState;
  returnValue?: unknown;
  root: React.JSX.Element;
};

declare global {
  interface AppEnvironment {}
}

export type UNSAFE_Context = {
  actionState?: Record<string, unknown>;
  env: AppEnvironment;
  headers: Headers;
  responseSent: boolean;
  session: Session<SessionData, SessionData>;
  status: number;
  statusText?: string;
  url: URL;
};

export const UNSAFE_ContextStorage = new AsyncLocalStorage<UNSAFE_Context>();

function ctx() {
  const ctx = UNSAFE_ContextStorage.getStore();
  if (!ctx) {
    throw new Error("No context store found");
  }
  return ctx;
}

function ctxNotSent() {
  const context = ctx();
  if (context.responseSent) {
    throw new Error("Response already sent");
  }
  return context;
}

export function getActionState<T>(key: string) {
  return ctx().actionState?.[key] as T | undefined;
}

export function setActionState<T>(key: string, state: T) {
  const context = ctx();
  context.actionState = {
    ...context.actionState,
    [key]: state,
  };
}

export function getCookieSession<T>(key: string) {
  return ctx().session.get(key) as T | undefined;
}

export function setCookieSession<T>(key: string, value: T) {
  ctxNotSent().session.set(key, value);
}

export function getEnv() {
  return ctx().env;
}

export function getURL() {
  return ctx().url;
}

export function setHeader(key: string, value: string) {
  ctxNotSent().headers.set(key, value);
}

export function setStatus(status: number, statusText?: string) {
  const context = ctxNotSent();
  context.status = status;
  context.statusText = statusText;
}

export async function renderApp(
  request: Request,
  cookie: CookieSessionStorageOptions["cookie"],
  env: AppEnvironment,
  root: React.JSX.Element
) {
  const sessionStorage = createCookieSessionStorage({ cookie });
  const session = await sessionStorage.getSession(
    request.headers.get("Cookie")
  );

  const url = new URL(request.url);

  const ctx: UNSAFE_Context = {
    env,
    url,
    headers: new Headers(),
    responseSent: false,
    session,
    status: 200,
  };

  return UNSAFE_ContextStorage.run(ctx, async () => {
    let formState: ReactFormState | undefined;
    let returnValue: unknown | undefined;

    const actionId = request.headers.get("rsc-action");
    try {
      if (actionId) {
        const reference = manifest.resolveServerReference(actionId);
        await reference.preload();
        const action = reference.get() as ((...args: unknown[]) => unknown) & {
          $$typeof: symbol;
        };
        if (action.$$typeof !== Symbol.for("react.server.reference")) {
          throw new Error("Invalid action");
        }

        const body = request.headers
          .get("Content-Type")
          ?.match(/^multipart\/form-data/)
          ? await request.formData()
          : await request.text();
        const args = await RSD.decodeReply(body, manifest);

        returnValue = action.apply(null, args);
        try {
          await returnValue;
        } catch {}
      } else if (request.method === "POST") {
        const formData = await request.formData();
        const action = await RSD.decodeAction(formData, manifest);
        formState = await RSD.decodeFormState(
          await action(),
          formData,
          manifest
        );
      }
    } catch (error) {
      console.error(error);
    }

    const payload = {
      formState,
      returnValue,
      root,
    } satisfies UNSAFE_ServerPayload;

    const { abort, pipe } = RSD.renderToPipeableStream(payload, manifest);

    request.signal.addEventListener("abort", () => abort());

    const body = stream.Readable.toWeb(
      pipe(new stream.PassThrough())
    ) as ReadableStream<Uint8Array>;

    const headers = new Headers(ctx.headers);
    headers.set("Content-Type", "text/x-component");
    headers.append("Set-Cookie", await sessionStorage.commitSession(session));

    ctx.responseSent = true;
    return new Response(body, {
      status: ctx.status,
      statusText: ctx.statusText,
      headers,
    });
  });
}
