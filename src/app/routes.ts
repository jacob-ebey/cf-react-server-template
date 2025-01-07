import { type RouteConfig, index, route } from "framework/react-router";

export default [
  index(() => import("./routes/home"), { id: "home" }),
  route("about", () => import("./routes/about"), {
    id: "about",
    children: [route(":id", () => import("./routes/server"), { id: "server" })],
  }),
  route("server", () => import("./routes/server"), {
    id: "server2",
    children: [route(":id", () => import("./routes/about"), { id: "about2" })],
  }),
] satisfies RouteConfig;
