import type { LoaderFunctionArgs } from "react-router";

export function loader({ params }: LoaderFunctionArgs) {
  return params.id || "About!";
}
