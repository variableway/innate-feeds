/**
 * OpenAPI 3.0 spec for the Innate Feeds API.
 * Served as JSON at /api/openapi.json and rendered by Swagger UI at /docs.
 * Keep in sync with the routes in server.ts (see docs/project/spec/contracts/feeds-api-v1.md).
 */

const errorResponse = {
  type: "object",
  properties: {
    error: { type: "string" },
    details: { type: "object", nullable: true },
  },
  required: ["error"],
} as const;

const jsonError = (description: string) => ({
  description,
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/Error" },
    },
  },
});

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Innate Feeds API",
    version: "1.1.0",
    description:
      "GitHub Trending / Starred 与社区 Issues Digest 的数据 API。\n\n" +
      "双模式：API 模式（本服务 + SQLite）与静态模式（`frontend/public/data/` 的 JSON chunks）。" +
      "sync 接口仅限本地/受信环境使用，不要暴露给未授权用户。",
    license: { name: "MIT" },
  },
  servers: [
    { url: "http://localhost:4000", description: "Local dev (API mode)" },
    { url: "/", description: "Same-origin (prod `bun run start`)" },
  ],
  tags: [
    { name: "Health", description: "服务与数据库健康检查" },
    { name: "Feeds", description: "Trending / Starred / Digest 列表与聚合" },
    { name: "Digest", description: "社区 Issues digest 单条详情" },
    { name: "Readmes", description: "README 缓存与拉取" },
    { name: "Plugins", description: "DSH 插件目录" },
    {
      name: "Topics",
      description: "GitHub Topics 数据源（每个 topic 的 top N 仓库）",
    },
    { name: "Auth", description: "GitHub 认证状态与 PAT" },
    { name: "Sync", description: "触发数据同步（勿对外暴露）" },
    { name: "Hidden", description: "隐藏 / 取消隐藏条目" },
    {
      name: "AdminDb",
      description: "简化版 SQLite 后台（只读查询 / 保存 SQL / JSON 文件查询）",
    },
  ],
  paths: {
    "/api/health": {
      get: {
        tags: ["Health"],
        summary: "健康检查",
        description: "探测服务与数据库可用性。",
        responses: {
          "200": {
            description: "服务正常",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    host: { type: "string", nullable: true },
                    port: { type: "integer", example: 4000 },
                  },
                  required: ["ok"],
                },
              },
            },
          },
          "503": jsonError("数据库不可用"),
        },
      },
    },

    "/api/feeds": {
      get: {
        tags: ["Feeds"],
        summary: "Feed 列表",
        description:
          "按类型返回 feed 条目。`type=digest` 走 digest 存储；`trending` / `starred` 走 SQLite。" +
          "搜索时未显式指定 `sort` 则按 FTS5 bm25 相关度排序。",
        parameters: [
          {
            name: "type",
            in: "query",
            description: "feed 类型",
            schema: {
              type: "string",
              enum: ["trending", "starred", "digest"],
              default: "trending",
            },
          },
          {
            name: "search",
            in: "query",
            description: "关键词（repo 名 / 描述 / topic）",
            schema: { type: "string" },
          },
          { name: "language", in: "query", schema: { type: "string" } },
          {
            name: "topics",
            in: "query",
            description: "逗号分隔的 topic 列表",
            schema: { type: "string" },
          },
          {
            name: "topic",
            in: "query",
            description: "单 topic（旧参数，等价 topics 一项）",
            schema: { type: "string" },
          },
          {
            name: "date",
            in: "query",
            description: "trending 快照日期 YYYY-MM-DD",
            schema: { type: "string" },
          },
          {
            name: "starsMin",
            in: "query",
            schema: { type: "integer" },
          },
          {
            name: "starsMax",
            in: "query",
            schema: { type: "integer" },
          },
          {
            name: "sort",
            in: "query",
            schema: {
              type: "string",
              enum: ["stars", "updated", "created", "starred"],
            },
          },
          {
            name: "order",
            in: "query",
            schema: { type: "string", enum: ["asc", "desc"], default: "desc" },
          },
          {
            name: "source",
            in: "query",
            description: "digest 来源过滤（type=digest 时）",
            schema: { type: "string", enum: ["ruanyf-weekly", "github-daily"] },
          },
          {
            name: "category",
            in: "query",
            description: "digest 分类过滤（type=digest 时）",
            schema: { type: "string" },
          },
          {
            name: "hasPrimaryUrl",
            in: "query",
            description: "digest：仅返回有原文链接的条目",
            schema: { type: "string", enum: ["1", "true"] },
          },
          {
            name: "page",
            in: "query",
            schema: { type: "integer", default: 1 },
          },
          {
            name: "pageSize",
            in: "query",
            schema: { type: "integer", default: 20 },
          },
        ],
        responses: {
          "200": {
            description: "分页结果",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/FeedResponse" },
              },
            },
          },
          "500": jsonError("服务器错误"),
        },
      },
    },

    "/api/feeds/stats": {
      get: {
        tags: ["Feeds"],
        summary: "聚合统计",
        responses: {
          "200": {
            description: "总数与 Top 语言",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    totalRepos: { type: "integer" },
                    trendingCount: { type: "integer" },
                    starredCount: { type: "integer" },
                    topLanguages: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          count: { type: "integer" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "500": jsonError("服务器错误"),
        },
      },
    },

    "/api/feeds/languages": {
      get: {
        tags: ["Feeds"],
        summary: "全部语言",
        responses: {
          "200": {
            description: "去重语言列表",
            content: {
              "application/json": {
                schema: { type: "array", items: { type: "string" } },
              },
            },
          },
          "500": jsonError("服务器错误"),
        },
      },
    },

    "/api/feeds/dates": {
      get: {
        tags: ["Feeds"],
        summary: "trending 快照日期",
        responses: {
          "200": {
            description: "可用日期（YYYY-MM-DD）",
            content: {
              "application/json": {
                schema: { type: "array", items: { type: "string" } },
              },
            },
          },
          "500": jsonError("服务器错误"),
        },
      },
    },

    "/api/topics": {
      get: {
        tags: ["Topics"],
        summary: "已同步的 GitHub Topics 索引",
        description:
          "每个 topic 的仓库数、新发现数、已在 trending/starred 中的数量与同步时间。",
        responses: {
          "200": {
            description: "topic 索引",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    topics: {
                      type: "array",
                      items: { $ref: "#/components/schemas/TopicSummary" },
                    },
                    updatedAt: { type: "string", nullable: true },
                  },
                },
              },
            },
          },
          "500": jsonError("服务器错误"),
        },
      },
      post: {
        tags: ["Topics"],
        summary: "保存用户新增的 GitHub Topic（GH #26）",
        description:
          "持久化到 topics/user-topics.json；后续默认 topic 同步会自动采集该 topic。",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AddTopicBody" },
            },
          },
        },
        responses: {
          "201": {
            description: "已保存；返回去重后的用户 topic 列表",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UserTopics" },
              },
            },
          },
          "400": jsonError("请求体无效"),
          "500": jsonError("服务器错误"),
        },
      },
    },

    "/api/topics/{topic}": {
      get: {
        tags: ["Topics"],
        summary: "单个 topic 的仓库列表",
        description:
          "返回该 topic 的完整 top-N 列表（含采集时被跳过的仓库，用 isNew / existing 标记）。",
        parameters: [
          {
            name: "topic",
            in: "path",
            required: true,
            description: "topic 名，例如 edtech",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "topic 快照",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/TopicDetail" },
              },
            },
          },
          "404": jsonError("未找到"),
          "500": jsonError("服务器错误"),
        },
      },
    },

    "/api/feeds/digest/{id}": {
      get: {
        tags: ["Digest"],
        summary: "Digest 单条详情",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: 'digest item id，形如 "digest-{source}-{issueId}"',
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "digest 条目（含 body）",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DigestFeedItem" },
              },
            },
          },
          "404": jsonError("未找到"),
          "500": jsonError("服务器错误"),
        },
      },
    },

    "/api/feeds/hide": {
      post: {
        tags: ["Hidden"],
        summary: "隐藏条目",
        description: "写入 `hidden.json`，所有列表/详情响应都会过滤掉它。",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/HideBody" },
            },
          },
        },
        responses: {
          "200": {
            description: "成功",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { ok: { type: "boolean" } },
                },
              },
            },
          },
          "400": jsonError("body 校验失败"),
          "500": jsonError("服务器错误"),
        },
      },
    },

    "/api/feeds/unhide": {
      post: {
        tags: ["Hidden"],
        summary: "取消隐藏",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/HideBody" },
            },
          },
        },
        responses: {
          "200": {
            description: "成功",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { ok: { type: "boolean" } },
                },
              },
            },
          },
          "400": jsonError("body 校验失败"),
          "500": jsonError("服务器错误"),
        },
      },
    },

    "/api/readmes": {
      get: {
        tags: ["Readmes"],
        summary: "README 缓存清单",
        responses: {
          "200": {
            description: "缓存根目录与文件列表",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    root: { type: "string" },
                    items: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          fullName: { type: "string" },
                          path: { type: "string" },
                          size: { type: "integer" },
                          mtime: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "500": jsonError("服务器错误"),
        },
      },
    },

    "/api/repos/{owner}/{repo}/readme": {
      get: {
        tags: ["Readmes"],
        summary: "获取 README",
        description:
          "磁盘缓存优先命中即返回；未命中则请求 GitHub 并回写缓存（后台刷新）。",
        parameters: [
          {
            name: "owner",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "repo",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "README 内容与元数据",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    fullName: { type: "string" },
                    markdown: { type: "string" },
                    cached: { type: "boolean" },
                  },
                },
              },
            },
          },
          "404": jsonError("仓库或 README 不存在"),
          "502": jsonError("GitHub 请求失败"),
          "500": jsonError("服务器错误"),
        },
      },
    },

    "/api/repos/{owner}/{repo}/readme/download": {
      get: {
        tags: ["Readmes"],
        summary: "下载 README（.md）",
        description: "返回 `text/markdown` 附件，文件名 `{owner}-{repo}.md`。",
        parameters: [
          {
            name: "owner",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "repo",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Markdown 附件",
            content: { "text/markdown": { schema: { type: "string" } } },
          },
          "404": jsonError("仓库或 README 不存在"),
          "502": jsonError("GitHub 请求失败"),
        },
      },
    },

    "/api/plugins": {
      get: {
        tags: ["Plugins"],
        summary: "DSH 插件搜索",
        parameters: [
          { name: "q", in: "query", schema: { type: "string" } },
          {
            name: "category",
            in: "query",
            description: "逗号分隔的分类 id",
            schema: { type: "string" },
          },
          {
            name: "sort",
            in: "query",
            schema: {
              type: "string",
              enum: ["stars", "recent", "name"],
            },
          },
          {
            name: "page",
            in: "query",
            schema: { type: "integer", default: 1 },
          },
          {
            name: "perPage",
            in: "query",
            schema: { type: "integer", default: 35 },
          },
        ],
        responses: {
          "200": {
            description: "分页插件结果",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: {
                      type: "array",
                      items: { $ref: "#/components/schemas/DshPlugin" },
                    },
                    total: { type: "integer" },
                    page: { type: "integer" },
                    perPage: { type: "integer" },
                  },
                },
              },
            },
          },
          "500": jsonError("服务器错误"),
        },
      },
    },

    "/api/plugins/stats": {
      get: {
        tags: ["Plugins"],
        summary: "插件统计",
        responses: {
          "200": {
            description: "插件总量与分类数",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    total: { type: "integer" },
                    categories: { type: "integer" },
                  },
                },
              },
            },
          },
          "500": jsonError("服务器错误"),
        },
      },
    },

    "/api/plugins/categories": {
      get: {
        tags: ["Plugins"],
        summary: "插件分类",
        responses: {
          "200": {
            description: "固定 20 个 awesome-dsh-plugin 分类",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      label: { type: "string" },
                      labelZh: { type: "string" },
                      emoji: { type: "string" },
                    },
                  },
                },
              },
            },
          },
          "500": jsonError("服务器错误"),
        },
      },
    },

    "/api/plugins/{slug}": {
      get: {
        tags: ["Plugins"],
        summary: "插件详情",
        parameters: [
          {
            name: "slug",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "插件详情",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DshPlugin" },
              },
            },
          },
          "404": jsonError("插件不存在"),
          "500": jsonError("服务器错误"),
        },
      },
    },

    "/api/plugins/{slug}/related": {
      get: {
        tags: ["Plugins"],
        summary: "相关插件",
        parameters: [
          {
            name: "slug",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "相关插件列表",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/DshPlugin" },
                },
              },
            },
          },
          "404": jsonError("插件不存在"),
          "500": jsonError("服务器错误"),
        },
      },
    },

    "/api/auth/status": {
      get: {
        tags: ["Auth"],
        summary: "认证状态",
        description: "gh CLI 是否可用、是否已存 PAT（不返回 token 本身）。",
        responses: {
          "200": {
            description: "认证状态",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    gh: {
                      type: "object",
                      properties: {
                        available: { type: "boolean" },
                        authenticated: { type: "boolean" },
                        username: { type: "string", nullable: true },
                      },
                    },
                    pat: {
                      type: "object",
                      properties: { stored: { type: "boolean" } },
                    },
                  },
                },
              },
            },
          },
          "500": jsonError("服务器错误"),
        },
      },
    },

    "/api/auth/pat": {
      put: {
        tags: ["Auth"],
        summary: "保存 GitHub PAT",
        description: "落盘加密存储（ADR-D5）。Body: `{ token }`。",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { token: { type: "string" } },
                required: ["token"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "已保存",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { ok: { type: "boolean" } },
                },
              },
            },
          },
          "400": jsonError("body 校验失败"),
          "500": jsonError("服务器错误"),
        },
      },
      delete: {
        tags: ["Auth"],
        summary: "删除已存 PAT",
        responses: {
          "200": {
            description: "已删除",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { ok: { type: "boolean" } },
                },
              },
            },
          },
          "500": jsonError("服务器错误"),
        },
      },
    },

    "/api/feeds/sync": {
      post: {
        tags: ["Sync"],
        summary: "触发数据同步",
        description:
          "**不要暴露给未授权用户。** 会调用 `gh` CLI / Firecrawl 采集并写库。",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SyncBody" },
            },
          },
        },
        responses: {
          "200": {
            description: "同步结果",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    synced: { type: "integer" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Zod 校验失败",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                    details: { type: "array", items: { type: "object" } },
                  },
                },
              },
            },
          },
          "500": jsonError("服务器错误"),
        },
      },
    },

    "/api/admin/db/tables": {
      get: {
        tags: ["AdminDb"],
        summary: "列出全部表与行数",
        description:
          "简化版 SQLite 后台。含 FTS 影子表（`internal: true` 标记）。只读连接执行。",
        responses: {
          "200": {
            description: "表清单",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    tables: {
                      type: "array",
                      items: { $ref: "#/components/schemas/AdminDbTable" },
                    },
                  },
                },
              },
            },
          },
          "503": jsonError("数据库不可用"),
        },
      },
    },

    "/api/admin/db/tables/{name}/schema": {
      get: {
        tags: ["AdminDb"],
        summary: "单表结构（列 / 索引 / DDL）",
        parameters: [
          {
            name: "name",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "表名（按 sqlite_master 白名单校验）",
          },
        ],
        responses: {
          "200": { description: "表结构" },
          "404": jsonError("表不存在"),
        },
      },
    },

    "/api/admin/db/query": {
      post: {
        tags: ["AdminDb"],
        summary: "执行只读 SQL",
        description:
          "仅接受单条 SELECT / WITH 语句；在独立只读连接上执行（写操作被 SQLite 硬拒绝）。" +
          "结果超过 500 行时截断（`truncated: true`）。",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AdminDbQueryBody" },
            },
          },
        },
        responses: {
          "200": {
            description: "查询结果（表格形）",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AdminDbQueryResult" },
              },
            },
          },
          "400": jsonError("SQL 校验失败或执行错误"),
        },
      },
    },

    "/api/admin/db/queries": {
      get: {
        tags: ["AdminDb"],
        summary: "保存的 SQL 列表",
        description: "首表时自动预置 R1 调研结论的示例查询。",
        responses: {
          "200": { description: "保存的 SQL 列表" },
        },
      },
      post: {
        tags: ["AdminDb"],
        summary: "新增保存的 SQL",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AdminDbSavedQueryBody" },
            },
          },
        },
        responses: {
          "201": { description: "已创建" },
          "400": jsonError("请求体不合法"),
          "409": jsonError("超出保存上限（200 条）"),
        },
      },
    },

    "/api/admin/db/queries/{id}": {
      put: {
        tags: ["AdminDb"],
        summary: "更新保存的 SQL",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AdminDbSavedQueryBody" },
            },
          },
        },
        responses: {
          "200": { description: "已更新" },
          "404": jsonError("不存在"),
        },
      },
      delete: {
        tags: ["AdminDb"],
        summary: "删除保存的 SQL",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          "200": { description: "已删除" },
          "404": jsonError("不存在"),
        },
      },
    },

    "/api/admin/db/json/files": {
      get: {
        tags: ["AdminDb"],
        summary: "已注册的 JSON 文件清单",
        description: "见 `POST /api/admin/db/json/scan`。",
        responses: {
          "200": { description: "文件清单（`valid` 为 json_valid 校验结果）" },
        },
      },
    },

    "/api/admin/db/json/scan": {
      post: {
        tags: ["AdminDb"],
        summary: "扫描 JSON 目录 → 注册进 json_documents 表",
        description:
          "递归扫描扫描根（默认 `~/.innate`，`ADMIN_JSON_DIR` 可覆盖），跳过 " +
          "node_modules / secrets / 隐藏目录，单文件上限 1MB。" +
          "注册表位于只读连接的 TEMP store，可用 `json_each` 等函数查询。",
        responses: {
          "200": {
            description: "扫描结果",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    root: { type: "string" },
                    fileCount: { type: "integer" },
                    totalBytes: { type: "integer" },
                    skipped: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
    },
  },

  components: {
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
          details: { type: "object", nullable: true },
        },
        required: ["error"],
      },

      GitHubRepo: {
        type: "object",
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
          fullName: { type: "string" },
          description: { type: "string", nullable: true },
          url: { type: "string" },
          homepage: { type: "string", nullable: true },
          stars: { type: "integer" },
          forks: { type: "integer" },
          watchers: { type: "integer" },
          language: { type: "string", nullable: true },
          topics: { type: "array", items: { type: "string" } },
          owner: {
            type: "object",
            properties: {
              login: { type: "string" },
              avatarUrl: { type: "string" },
              url: { type: "string" },
            },
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
        required: ["id", "fullName", "stars"],
      },

      FeedItem: {
        type: "object",
        properties: {
          id: { type: "string" },
          type: { type: "string", enum: ["trending", "starred"] },
          snapshotDate: { type: "string", nullable: true },
          repo: { $ref: "#/components/schemas/GitHubRepo" },
          fetchedAt: { type: "string", format: "date-time" },
          starredAt: { type: "string", format: "date-time", nullable: true },
        },
      },

      DigestFeedItem: {
        type: "object",
        properties: {
          id: { type: "string" },
          type: { type: "string", example: "digest" },
          title: { type: "string" },
          summary: { type: "string", nullable: true },
          body: { type: "string", nullable: true },
          url: { type: "string", nullable: true },
          source: {
            type: "string",
            enum: ["ruanyf-weekly", "github-daily"],
          },
          category: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },

      FeedResponse: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              oneOf: [
                { $ref: "#/components/schemas/FeedItem" },
                { $ref: "#/components/schemas/DigestFeedItem" },
              ],
            },
          },
          total: { type: "integer" },
          page: { type: "integer" },
          pageSize: { type: "integer" },
        },
        required: ["items", "total"],
      },

      TopicSummary: {
        type: "object",
        properties: {
          topic: { type: "string" },
          count: { type: "integer", description: "快照中的仓库总数" },
          newCount: {
            type: "integer",
            description: "新发现数（本次同步首次出现且不在 feeds 中）",
          },
          existingCount: {
            type: "integer",
            description: "已在 trending/starred feeds 中的仓库数",
          },
          fetchedAt: { type: "string" },
        },
        required: ["topic", "count", "newCount", "existingCount", "fetchedAt"],
      },

      AddTopicBody: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            minLength: 1,
            maxLength: 100,
            description: "GitHub topic 名，保存时统一为小写 slug",
          },
        },
        required: ["topic"],
      },

      UserTopics: {
        type: "object",
        properties: {
          topics: { type: "array", items: { type: "string" } },
        },
        required: ["topics"],
      },

      TopicRepo: {
        type: "object",
        properties: {
          id: { type: "string" },
          repoId: { type: "integer" },
          fullName: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          url: { type: "string" },
          homepage: { type: "string", nullable: true },
          stars: { type: "integer" },
          forks: { type: "integer" },
          watchers: { type: "integer" },
          language: { type: "string", nullable: true },
          topics: { type: "array", items: { type: "string" } },
          owner: {
            type: "object",
            properties: {
              login: { type: "string" },
              avatarUrl: { type: "string" },
              url: { type: "string" },
            },
          },
          createdAt: { type: "string" },
          updatedAt: { type: "string" },
          firstSeenAt: {
            type: "string",
            description: "首次出现在该 topic 的时间",
          },
          isNew: { type: "boolean", description: "本次同步首次出现" },
          existing: {
            type: "boolean",
            description: "已存在于 trending/starred feeds（采集时被跳过）",
          },
        },
        required: ["id", "fullName", "url", "stars", "isNew", "existing"],
      },

      TopicDetail: {
        type: "object",
        properties: {
          topic: { type: "string" },
          fetchedAt: { type: "string" },
          count: { type: "integer" },
          newCount: { type: "integer" },
          existingCount: { type: "integer" },
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/TopicRepo" },
          },
        },
        required: ["topic", "fetchedAt", "count", "items"],
      },

      HideBody: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["digest", "repo"] },
          id: {
            type: "string",
            minLength: 1,
            maxLength: 200,
            description:
              'digest: item id ("digest-{source}-{issueId}")；repo: fullName ("owner/repo")',
          },
        },
        required: ["kind", "id"],
      },

      SyncBody: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["trending", "starred", "all-trending"],
          },
          period: {
            type: "string",
            enum: ["daily", "weekly", "monthly"],
          },
          username: {
            type: "string",
            pattern: "^[\\w.-]{1,39}$",
          },
          force: { type: "boolean" },
          days: {
            type: "integer",
            minimum: 1,
            maximum: 365,
            description: "starred 增量窗口（天）",
          },
        },
        required: ["type"],
      },

      DshPlugin: {
        type: "object",
        properties: {
          slug: { type: "string" },
          name: { type: "string" },
          description: { type: "string", nullable: true },
          author: { type: "string", nullable: true },
          repoUrl: { type: "string", nullable: true },
          stars: { type: "integer", nullable: true },
          category: { type: "string", nullable: true },
          installCommand: { type: "string", nullable: true },
        },
      },

      AdminDbTable: {
        type: "object",
        properties: {
          name: { type: "string" },
          rowCount: { type: "integer" },
          kind: { type: "string", enum: ["table", "view"] },
          internal: { type: "boolean", description: "FTS 影子表等内部表" },
        },
      },

      AdminDbQueryBody: {
        type: "object",
        properties: {
          sql: { type: "string", description: "单条 SELECT / WITH 语句" },
        },
        required: ["sql"],
      },

      AdminDbQueryResult: {
        type: "object",
        properties: {
          columns: { type: "array", items: { type: "string" } },
          rows: {
            type: "array",
            items: { type: "object", additionalProperties: true },
          },
          rowCount: { type: "integer" },
          truncated: { type: "boolean" },
          rowLimit: { type: "integer" },
          durationMs: { type: "number" },
        },
      },

      AdminDbSavedQueryBody: {
        type: "object",
        properties: {
          name: { type: "string", maxLength: 120 },
          sql: { type: "string" },
          description: { type: "string", maxLength: 500, nullable: true },
        },
        required: ["name", "sql"],
      },
    },
  },
} as const;

/** Plain JSON-safe copy (drops `as const` readonly-ness for the runtime Response). */
export function getOpenApiSpec(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(openApiSpec));
}
