import { matchRoutes } from "react-router";

import { ServerRouter } from "framework/react-router";
import { getURL, setStatus } from "framework/server";

import { GlobalPendingIndicator } from "./app.client";
import stylesHref from "./app.css?url";

import routes from "./_routes";

export function App() {
  const url = getURL();
  const matches = matchRoutes(routes, url.pathname + url.search);

  if ((matches?.length ?? 0) > 1) {
    return <ServerRouter routes={routes} />;
  }

  setStatus(404);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>React Server</title>
        <link rel="stylesheet" href={stylesHref} />
      </head>
      <body>
        <GlobalPendingIndicator />
        <main className="typography py-20 px-4 md:px-6 mx-auto w-full container">
          <h1>404</h1>
          <a href="/">Home</a>
        </main>
      </body>
    </html>
  );
}
