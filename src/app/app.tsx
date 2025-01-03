import {
  destoryCookieSession,
  getCookieSession,
  getURL,
} from "framework/server";

import stylesHref from "./app.css?url";

import Dashboard from "./dashboard";
import Login from "./login/login";
import Signup from "./signup/signup";

export async function App() {
  const url = getURL();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>React Server</title>
        <link rel="stylesheet" href={stylesHref} />
      </head>
      <body>
        {(() => {
          switch (url.pathname) {
            case "/dashboard":
              return <Dashboard />;
            case "/signup":
              return <Signup />;
            default:
              return <Login />;
          }
        })()}
      </body>
    </html>
  );
}
