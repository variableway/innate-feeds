/**
 * Host 可见性裁量（sprint-3 B7，module-partition-design §2）。
 *
 * 域包照常声明全部 navItems；host 决定露谁。可见性是 host 的关注点，
 * 不写入 @innate/web-domain（base 包）也不写入各域包。
 * M2 落地 curation/visibility.ts（源可见性唯一定义）后，本配置退化为消费方。
 */

/** 可见导航路径（精确匹配）。 */
const VISIBLE_PATHS = new Set([
  "/", // 主页（sprint-3 B3 时间轨）
  "/trending",
  "/trending-shift",
  "/starred",
  "/admin", // SQLite 工作台（开发工具）
]);

/** 可见路径前缀（域包的子路由组，如 /edu、/starred/$id）。 */
const VISIBLE_PREFIXES = ["/edu", "/starred", "/ux", "/anti-ai"];

/**
 * hidden 页面（路由保留，URL 直达可用，数据照常采集）：
 * /digest、/topics、/feeds*（外部源）、/dsh*——等 M2 Topic Hub / visibility 升级。
 */
export function isNavPathVisible(path: string): boolean {
  if (VISIBLE_PATHS.has(path)) return true;
  return VISIBLE_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}
