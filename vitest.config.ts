import { readFileSync } from "fs";
import { defineConfig, type Plugin } from "vitest/config";

/**
 * Vite has no built-in loader for `*.sql`. Bun (runtime + `bun build --compile`)
 * supports `import x from "./f.sql" with { type: "text" }` and embeds it; this
 * plugin mirrors that for vitest/Vite so the same import works under test.
 */
function sqlTextPlugin(): Plugin {
  return {
    name: "sql-text-loader",
    load(id) {
      if (id.endsWith(".sql")) {
        const text = readFileSync(id, "utf-8");
        return `export default ${JSON.stringify(text)};`;
      }
      return undefined;
    },
  };
}

export default defineConfig({
  plugins: [sqlTextPlugin()],
  test: {
    include: ["backend/src/**/*.test.ts"],
  },
});
