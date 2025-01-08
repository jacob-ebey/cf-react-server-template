import { renderApp } from "framework/server";

import routes from "~/routes";

import { TodoList } from "./todo-list";
import { User } from "./user";

import { handleReactRouterRequest } from "framework/react-router";

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
    const response = await handleReactRouterRequest(request, routes);
    if (response) return response;

    const { App } = await import("../app/app");

    const url = new URL(request.url);
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
