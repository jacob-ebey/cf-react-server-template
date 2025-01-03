import { renderApp } from "framework/server";

import { Counter } from "./counter";

declare global {
  interface AppEnvironment {
    COUNTER: DurableObjectNamespace<Counter>;
    SESSION_SECRET: string;
    USERS: KVNamespace;
  }
}

export { Counter };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { App } = await import("../app/app");

    return renderApp(
      request,
      {
        httpOnly: true,
        secrets: [env.SESSION_SECRET],
        secure: url.protocol === "https:",
      },
      env,
      <App />
    );
  },
} satisfies ExportedHandler<AppEnvironment>;
