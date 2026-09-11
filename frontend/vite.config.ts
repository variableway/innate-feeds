import { copyFileSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

const __dirname = dirname(fileURLToPath(import.meta.url));
const uiThemesPath = resolve(
  __dirname,
  "../../../../base/innate-fe-base/packages/ui/src/themes",
);

function githubPagesPlugin(): Plugin {
  return {
    name: "github-pages",
    closeBundle() {
      const dist = join(__dirname, "dist");
      copyFileSync(join(dist, "index.html"), join(dist, "404.html"));
      writeFileSync(join(dist, ".nojekyll"), "");
    },
  };
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [tsconfigPaths(), tailwindcss(), react(), githubPagesPlugin()],
  resolve: {
    alias: {
      "@innate/ui/themes": uiThemesPath,
    },
  },
  server: {
    fs: {
      allow: [
        resolve(__dirname, ".."),
        resolve(__dirname, "../../../../base/innate-fe-base"),
      ],
    },
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
});
