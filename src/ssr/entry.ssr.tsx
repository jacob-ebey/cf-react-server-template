import { isReactRouterDataRequest } from "framework/react-router.client";
import { renderServerResponse } from "framework/ssr";

type CloudflareEnv = {
  ASSETS: Fetcher;
  SERVER: Fetcher;
};

export default {
  async fetch(request, { ASSETS, SERVER }) {
    const url = new URL(request.url);
    if (isReactRouterDataRequest(url)) {
      return SERVER.fetch(request);
    }
    return renderServerResponse(request, ASSETS, (request) =>
      SERVER.fetch(request)
    );
  },
} satisfies ExportedHandler<CloudflareEnv>;
