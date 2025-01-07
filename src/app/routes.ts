import { type RouteConfig, index, route } from "framework/react-router";

export default [
  index(() => import("./routes/home"), { id: "home" }),
  route("about/:id?", () => import("./routes/about"), { id: "about" }),
] satisfies RouteConfig;
