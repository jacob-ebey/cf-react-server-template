// @ts-expect-error - no types
import RSD from "@jacob-ebey/react-server-dom-vite/client";
import RDS from "react-dom/server";
import { injectRSCPayload } from "rsc-html-stream/server";
// @ts-expect-error - no types yet
import { bootstrapModules, manifest } from "virtual:react-manifest";
import type { UNSAFE_ServerPayload } from "./server";

export async function renderServerResponse(
  request: Request,
  ASSETS: Fetcher,
  sendServerRequest: (request: Request) => Promise<Response>
) {
  const isDataRequest = request.headers
    .get("Accept")
    ?.match(/\btext\/x-component\b/);

  let serverResponse: Response | undefined;
  let isPrerendered = false;
  if (request.method === "GET") {
    const prerenderURL = new URL(request.url);
    prerenderURL.pathname =
      "/_prerender" +
      (prerenderURL.pathname === "/" ? "/index" : prerenderURL.pathname) +
      (isDataRequest ? ".data" : ".html");
    const prerenderResponse = await ASSETS.fetch(prerenderURL, {
      headers: request.headers,
      cf: {
        cacheTtl: 300,
        cacheTtlByStatus: {
          "200": 300,
          "404": 300,
        },
      },
    });
    if (prerenderResponse.status === 200 || prerenderResponse.status === 304) {
      const headers = new Headers(prerenderResponse.headers);
      if (isDataRequest) {
        headers.set("Content-Type", "text/x-component");
      } else {
        headers.set("Content-Type", "text/html; charset=utf-8");
      }
      serverResponse = new Response(prerenderResponse.body, {
        duplex: "half",
        headers,
        status: prerenderResponse.status,
        statusText: prerenderResponse.statusText,
      } as ResponseInit);
      isPrerendered = true;
    }
  }

  if (!serverResponse) {
    serverResponse = await sendServerRequest(request);
  }

  if (isDataRequest || (!isDataRequest && isPrerendered)) {
    return serverResponse;
  }

  if (!serverResponse.body) {
    throw new Error("Expected response body");
  }

  let [rscA, rscB] = serverResponse.body.tee();

  const payload: UNSAFE_ServerPayload = await RSD.createFromReadableStream(
    rscA,
    manifest
  );

  const url = new URL(request.url);
  if (payload.location !== url.pathname + url.search) {
    return new Response(null, {
      headers: serverResponse.headers,
      status:
        serverResponse.status >= 300 && serverResponse.status < 400
          ? serverResponse.status
          : 303,
    });
  }

  const body = await RDS.renderToReadableStream(payload.root, {
    bootstrapModules,
    // @ts-expect-error - no types yet
    formState: payload.formState,
    signal: request.signal,
  });

  const headers = new Headers(serverResponse.headers);
  headers.set("Content-Type", "text/html; charset=utf-8");

  if (request.headers.get("PRERENDER") === "1") {
    let tee = rscB.tee();
    rscB = tee[0];
    let rscPayload = "";
    await tee[1].pipeThrough(new TextDecoderStream()).pipeTo(
      new WritableStream({
        write(chunk) {
          rscPayload += chunk;
        },
      })
    );
    await body.allReady;
    headers.set("X-RSC-Payload", encodeURI(rscPayload));
  }

  return new Response(body.pipeThrough(injectRSCPayload(rscB)), {
    headers,
    status: serverResponse.status,
    statusText: serverResponse.statusText,
  });
}
