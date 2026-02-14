import { serve } from "bun";
import { apiRoutes, initializeApplicationData } from "@viralvector/server-api/api";
import index from "./index.html";

await initializeApplicationData();

const server = serve({
  routes: {
    ...apiRoutes,
    "/*": index,
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`AI Video Engine running at ${server.url}`);
