import { renderApp } from "framework/server";

import { TodoList } from "./todo-list";
import { User } from "./user";

declare global {
  interface AppEnvironment {
    TODO_LIST: DurableObjectNamespace<TodoList>;
    SESSION_SECRET: string;
    USER: DurableObjectNamespace<User>;
    USERS: KVNamespace;
  }
}

export { TodoList, User };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { App } = await import("../app/app");

    return renderApp(
      request,
      {
        httpOnly: true,
        secrets: env.SESSION_SECRET ? [env.SESSION_SECRET] : undefined,
        secure: url.protocol === "https:",
      },
      env,
      <App />
    );
  },
} satisfies ExportedHandler<AppEnvironment>;
