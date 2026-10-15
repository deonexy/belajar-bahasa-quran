import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname) } },
  test: {
    environment: "node",
    setupFiles: ["lib/local/__tests__/setup.ts"],
    include: ["lib/**/*.test.ts", "scripts/**/*.test.ts", "supabase/functions/**/*.test.ts"],
  },
});
