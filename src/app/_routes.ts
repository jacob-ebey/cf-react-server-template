import { type RouteConfig, index, route } from "framework/react-router";

export default [
  route("", () => import("./_root"), {
    id: "root",
    children: [
      index(() => import("./_routes/home"), { id: "home" }),
      route("about", () => import("./_routes/about"), {
        id: "about",
        children: [
          route(":id", () => import("./_routes/server"), { id: "server" }),
        ],
      }),
      route("server", () => import("./_routes/server"), {
        id: "server2",
        children: [
          route(":id", () => import("./_routes/about"), { id: "about2" }),
        ],
      }),
    ],
  }),
] satisfies RouteConfig;
