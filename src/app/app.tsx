import {
  destoryCookieSession,
  getCookieSession,
  getURL,
} from "framework/server";

import stylesHref from "./app.css?url";

import Login from "./login/login";
import Signup from "./signup/signup";

export async function App() {
  const url = getURL();

  const loggedIn = !!getCookieSession("userId");

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>React Server</title>
        <link rel="stylesheet" href={stylesHref} />
      </head>
      <body>
        {loggedIn ? (
          <main className="container w-full mx-auto px-4 md:px-6 py-16 typography">
            <h1>Welcome!</h1>
            <p>You are logged in.</p>
            <form
              action={() => {
                "use server";
                destoryCookieSession();
              }}
            >
              <button type="submit">Logout</button>
            </form>
          </main>
        ) : (
          (() => {
            switch (url.pathname) {
              case "/signup":
                return <Signup />;
              default:
                return <Login />;
            }
          })()
        )}
      </body>
    </html>
  );
}
