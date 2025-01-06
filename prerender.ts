// Dependant on https://github.com/flarelabs-net/vite-plugin-cloudflare/pull/125

import * as fsp from "node:fs/promises";
import * as path from "node:path";

import { $ } from "execa";

const PATHS_TO_PRERENDER = ["/", "/signup"];

const port = 4173;
const host = "localhost";
const proc = $`pnpm preview --host ${host} --port ${port}`;

async function waitForPort() {
  const timeout = 10000;

  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      await fetch(`http://${host}:${port}`);
      return;
    } catch (error) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

try {
  await waitForPort();

  for (const pathname of PATHS_TO_PRERENDER) {
    console.log(`prerendering ${pathname}`);
    const response = await fetch(
      new URL(pathname, `http://${host}:${port}`).href,
      {
        headers: {
          PRERENDER: "1",
        },
      }
    );

    const rscPayload = decodeURI(response.headers.get("X-RSC-Payload") || "");

    if (response.status !== 200 || !rscPayload) {
      throw new Error(`Failed to prerender rsc payload for ${pathname}`);
    }

    const html = await response.text();
    if (!html.includes("<!DOCTYPE html>")) {
      throw new Error(`Failed to prerender html for ${pathname}`);
    }

    const segments = pathname.split("/").filter(Boolean);
    if (segments.length === 0) {
      segments.push("index");
    }
    const lastSegment = segments.pop();
    const rscPath = path.join(
      "dist",
      "client",
      "_prerender",
      ...segments,
      lastSegment + ".data"
    );
    const htmlPath = path.join(
      "dist",
      "client",
      "_prerender",
      ...segments,
      lastSegment + ".html"
    );

    await fsp.mkdir(path.dirname(rscPath), { recursive: true });

    await Promise.all([
      fsp.writeFile(rscPath, rscPayload),
      fsp.writeFile(htmlPath, html),
    ]);
  }
} finally {
  proc.kill();
}
