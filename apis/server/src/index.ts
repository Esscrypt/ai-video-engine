import { serve } from "bun";
import { apiRoutes, initializeApplicationData } from "./api";

await initializeApplicationData();

const apiServer = serve({
  port: Number(process.env.PORT ?? 3001),
  routes: {
    ...apiRoutes,
  },
});

console.log(`ViralVector API server running at ${apiServer.url}`);
