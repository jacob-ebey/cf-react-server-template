import type { RouteConfig } from "@react-router/dev/routes";
import { layout, index } from "@react-router/dev/routes";

export default [
  layout("root.tsx", [index("routes/home.tsx")]),
] satisfies RouteConfig;
