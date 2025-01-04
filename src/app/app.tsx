import {
  destoryCookieSession,
  getCookieSession,
  getURL,
} from "framework/server";

import stylesHref from "./app.css?url";

import Login from "./login/login";
import Signup from "./signup/signup";
import Todo from "./todo/todo";

export function App() {
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
          const pathStart = url.pathname.split("/", 2).join("/");
          switch (pathStart) {
            case "/todo":
              return <Todo />;
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
