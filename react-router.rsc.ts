// To build me, run the following command from the root of this repository:
// npx esbuild --bundle react-router.rsc.ts --format=esm --platform=node --outfile=react-router.rsc.js --minify --define:process.env.NODE_ENV=\\\"production\\\"

export { matchRoutes, createStaticHandler } from "react-router";
