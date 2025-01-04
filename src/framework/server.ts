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
  location: string;
  returnValue?: unknown;
  root: React.JSX.Element;
};

declare global {
  interface AppEnvironment {}
}

export type UNSAFE_Context = {
  stage: "action" | "render" | "sent";
  actionState?: Record<string, unknown>;
  destorySession?: true;
  env: AppEnvironment;
  headers: Headers;
  redirect?: string;
  session: Session<SessionData, SessionData>;
  status: number;
  statusText?: string;
  url: URL;
  waitToFlushUntil: Promise<unknown>[];
};

export const UNSAFE_ContextStorage = new AsyncLocalStorage<UNSAFE_Context>();

function ctx() {
  const ctx = UNSAFE_ContextStorage.getStore();
  if (!ctx) {
    throw new Error("No context store found");
  }
  if (ctx.stage === "sent") {
    throw new Error("Response already sent");
  }
  return ctx;
}

function ctxActionsOnly() {
  const context = ctx();
  if (context.stage !== "action") {
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
  ctxActionsOnly().session.set(key, value);
}

export function destoryCookieSession() {
  const context = ctxActionsOnly();
  context.destorySession = true;
  for (const key of Object.keys(context.session.data)) {
    context.session.unset(key);
  }
}

export function getEnv() {
  return ctx().env;
}

export function getURL() {
  return ctx().url;
}

export function setHeader(key: string, value: string) {
  ctxActionsOnly().headers.set(key, value);
}

export function setStatus(status: number, statusText?: string) {
  const context = ctxActionsOnly();
  if (context.redirect) {
    throw new Error("Cannot set status after redirect");
  }
  context.status = status;
  context.statusText = statusText;
}

export function redirect(to: string, status?: number): undefined {
  const context = ctx();
  context.status =
    typeof status === "number"
      ? status
      : context.stage === "action"
      ? 303
      : 307;
  context.redirect = to;
}

export function waitToFlushUntil<T>(
  waitFor: Promise<T> | (() => Promise<T>)
): Promise<T> {
  const context = ctx();
  if (context.stage === "sent") {
    throw new Error("Response already sent");
  }

  const promise = typeof waitFor === "function" ? waitFor() : waitFor;

  context.waitToFlushUntil.push(
    Promise.resolve(promise).then(
      () => {},
      () => {}
    )
  );

  return promise;
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

  let _redirect: string | undefined;
  let onRedirect: ((to: string) => void) | undefined;
  const ctx: UNSAFE_Context = {
    stage: "action",
    env,
    url,
    headers: new Headers(),
    session,
    status: 200,
    waitToFlushUntil: [],
    get redirect() {
      return _redirect;
    },
    set redirect(to: string | undefined) {
      _redirect = to;
      if (to && onRedirect) onRedirect(to);
    },
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

    if (ctx.redirect) {
      const headers = new Headers(ctx.headers);
      headers.set("Content-Type", "text/plain");
      headers.append(
        "Set-Cookie",
        ctx.destorySession
          ? await sessionStorage.destroySession(session)
          : await sessionStorage.commitSession(session)
      );
      headers.set("Location", ctx.redirect);

      return new Response(`redirect ${ctx.redirect}`, {
        status: ctx.status,
        headers,
      });
    }

    const payload = {
      formState,
      location: url.pathname + url.search,
      returnValue,
      root,
    } satisfies UNSAFE_ServerPayload;

    ctx.stage = "render";
    const { abort, pipe } = RSD.renderToPipeableStream(payload, manifest);
    request.signal.addEventListener("abort", () => abort());
    const body = stream.Readable.toWeb(
      pipe(new stream.PassThrough())
    ) as ReadableStream<Uint8Array>;

    // Always allow the render to susspend once before sending the response? IDK if this actually accomplishes that.
    await new Promise((r) => setTimeout(r, 0));

    await Promise.all(ctx.waitToFlushUntil);

    ctx.stage = "sent";
    const headers = new Headers(ctx.headers);
    headers.set("Content-Type", "text/x-component");
    headers.append(
      "Set-Cookie",
      ctx.destorySession
        ? await sessionStorage.destroySession(session)
        : await sessionStorage.commitSession(session)
    );
    if (ctx.redirect) {
      headers.set("Location", ctx.redirect);
    }

    let gotLateRedirect = false;
    onRedirect = () => {
      gotLateRedirect = true;
    };
    return new Response(
      body.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
          flush(controller) {
            if (gotLateRedirect) {
              throw new Error("TODO: Implement late redirects");
              // controller.enqueue(
              //   new TextEncoder().encode(
              //     `\n\n${JSON.stringify({
              //       redirect: ctx.redirect,
              //     })}\n`
              //   )
              // );
            }
          },
        })
      ),
      {
        status: ctx.status,
        statusText: ctx.statusText,
        headers,
      }
    );
  });
}
