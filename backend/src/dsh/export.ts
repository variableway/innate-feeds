/**
 * DSH plugin catalog 静态导出（issue #13 抽离）。
 *
 * 静态模式（GitHub Pages）没有后端，plugins.json 由 export-incremental
 * 调用本模块写出，dsh 域前端在客户端镜像搜索（services/plugins.ts）。
 */
import { join } from "path";
import { writeFileSync } from "fs";
import { getPlugins } from "./catalog.js";

export function exportPluginCatalog(outDir: string, generatedAt: string) {
  try {
    const plugins = getPlugins();
    if (plugins.length === 0) return;
    const pluginsPath = join(outDir, "plugins.json");
    writeFileSync(
      pluginsPath,
      JSON.stringify({
        version: 1,
        generatedAt,
        plugins,
      }),
    );
    console.log(
      `Exported plugin catalog → ${pluginsPath} (${plugins.length} plugins)`,
    );
  } catch (err) {
    console.warn(
      "Skipped plugin catalog export:",
      err instanceof Error ? err.message : err,
    );
  }
}
