import { ServerRouter } from "framework/react-router";

import { GlobalPendingIndicator } from "./app.client";
import stylesHref from "./app.css?url";

import routes from "./routes";

export async function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>React Server</title>
        <link rel="stylesheet" href={stylesHref} />
      </head>
      <body>
        <GlobalPendingIndicator />
        <ServerRouter routes={routes} />
      </body>
    </html>
  );
}
