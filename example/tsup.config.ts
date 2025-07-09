import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/app-telemetry.ts"],
  format: ["esm", "cjs"],
  dts: false,
  sourcemap: false,
  clean: true,
});
