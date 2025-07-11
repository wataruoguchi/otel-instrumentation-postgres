import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: false,
    sourcemap: false,
    clean: true,
  },
  {
    entry: ["src/app-telemetry.ts"],
    format: ["cjs"], // only need cjs for --require
    dts: false,
    sourcemap: false,
    clean: false, // don't clean dist again
  },
]);
