import { serve } from "@hono/node-server";
import { getApp } from "./app.js";
import { getDb } from "./infrastructure/database.js";
import { getEnv } from "./shared/env.js";

// Create the app instance for export
const app = getApp(getDb());

// Start the server
serve(
  {
    fetch: app.fetch,
    port: getEnv().PORT,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);

// Export the app for Vite SSR build
export default app;
