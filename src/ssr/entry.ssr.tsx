import { renderServerResponse } from "framework/ssr";

type CloudflareEnv = {
  ASSETS: Fetcher;
  SERVER: Fetcher;
};

export default {
  async fetch(request, { ASSETS, SERVER }) {
    return renderServerResponse(request, ASSETS, (request) =>
      SERVER.fetch(request)
    );
  },
} satisfies ExportedHandler<CloudflareEnv>;
