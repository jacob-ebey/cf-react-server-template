import { Outlet, useNavigation } from "react-router";
import { useNavigation as useFrameworkNavigation } from "framework/client";

import stylesHref from "./app.css?url";

import { GlobalLoader } from "~/components/ui/global-loader";

function GlobalPendingIndicator() {
  const navigation = useNavigation();
  const frameworkNavigation = useFrameworkNavigation();

  return (
    <GlobalLoader
      loading={
        frameworkNavigation.state !== "idle" || navigation.state !== "idle"
      }
    />
  );
}

export function Component() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>React Router</title>
        <link rel="stylesheet" href={stylesHref} />
      </head>
      <body>
        <GlobalPendingIndicator />
        <header className="typography py-20 px-4 md:px-6 mx-auto w-full container">
          <h1>React Router</h1>
        </header>
        <Outlet />
      </body>
    </html>
  );
}
