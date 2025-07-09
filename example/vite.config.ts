import devServer from "@hono/vite-dev-server";
import nodeAdapter from "@hono/vite-dev-server/node";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ command, mode }) => {
  const port = mode === "test" ? 3000 : getPort();
  let httpsOptions: { key: Buffer; cert: Buffer } | undefined;
  try {
    httpsOptions = {
      key: fs.readFileSync(
        path.resolve(__dirname, "../../.certificates/localhost-key.pem"),
      ),
      cert: fs.readFileSync(
        path.resolve(__dirname, "../../.certificates/localhost.pem"),
      ),
    };
  } catch {
    console.warn("HTTPS certificates not found, falling back to HTTP");
  }

  if (command === "build") {
    throw new Error(
      "The `vite build` command is not supported for production builds in this project. " +
        "Please use the TypeScript compiler (`tsc`) or the dedicated production build script instead. " +
        "Refer to the project documentation for more details.",
    );
  }

  return {
    plugins: [
      tsConfigPaths(),
      devServer({
        adapter: nodeAdapter,
        entry: "./src/index.ts",
      }),
    ],
    server: {
      port,
      ...(httpsOptions ? { https: httpsOptions } : {}),
    },
    test: {
      globals: true,
      environment: "node",
      env: {
        AUTH0_DOMAIN: "test.auth0.com",
        AUTH0_CLIENT_MANAGEMENT_ID: "test-management-client-id",
        AUTH0_CLIENT_MANAGEMENT_SECRET: "test-management-client-secret",
        AUTH0_CLIENT_ID: "test-client-id",
        AUTH0_CONNECTION_ID: "test-connection-id",
        PRIMARY_ORGANIZATION_ID: "org_1234567890",
      },
    },
  };
});

const getPort = () => {
  const portStr = process.env.PORT;
  if (!portStr) {
    throw new Error("PORT is not set");
  }
  return Number.parseInt(portStr);
};
