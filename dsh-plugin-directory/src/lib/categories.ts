/**
 * The 20 fixed awesome-dsh-plugin categories.
 * Kept in sync with awesome-dsh-plugin/scripts/lib/entries.mjs (CAT_IDS/CAT_EMOJI)
 * and awesome-dsh-plugin/site/locales.mjs (en/zh display names).
 */
export const CATEGORIES = [
  { id: "ui", label: "UI Enhancements", labelZh: "UI 增强", emoji: "🎨" },
  { id: "usage", label: "Usage & Billing", labelZh: "用量与计费", emoji: "💰" },
  { id: "theme", label: "Themes & Appearance", labelZh: "主题与外观", emoji: "🎭" },
  { id: "model", label: "Models & Providers", labelZh: "模型与账号接入", emoji: "🔌" },
  { id: "session", label: "Sessions & Messages", labelZh: "会话与消息", emoji: "💬" },
  { id: "memory", label: "Memory", labelZh: "记忆", emoji: "🧠" },
  { id: "tools", label: "Tools & Capabilities", labelZh: "工具与能力", emoji: "🛠️" },
  { id: "browser", label: "Browser & Web", labelZh: "浏览器与网页", emoji: "🌐" },
  { id: "vision", label: "Vision & Multimodal", labelZh: "视觉与多模态", emoji: "🖼️" },
  { id: "voice", label: "Voice & Audio", labelZh: "语音与音频", emoji: "🎙️" },
  { id: "docs", label: "Docs & Rendering", labelZh: "文档与渲染", emoji: "📄" },
  { id: "skill", label: "Skills", labelZh: "技能包", emoji: "🧩" },
  { id: "workflow", label: "Workflow & Automation", labelZh: "工作流与自动化", emoji: "🔁" },
  { id: "git", label: "Git & Code Review", labelZh: "Git 与代码评审", emoji: "🔀" },
  { id: "notify", label: "Notifications & Integrations", labelZh: "通知与集成", emoji: "🔔" },
  { id: "dev", label: "Development & Runtime", labelZh: "开发与运行时", emoji: "🧑‍💻" },
  { id: "security", label: "Security & Permissions", labelZh: "安全与权限", emoji: "🔒" },
  { id: "remote", label: "Remote & Mobile", labelZh: "远程与移动端", emoji: "📱" },
  { id: "market", label: "Plugin Markets & Managers", labelZh: "插件市场与管理", emoji: "🛒" },
  { id: "fun", label: "Just for Fun", labelZh: "娱乐", emoji: "🎮" },
] as const

export type CategoryId = (typeof CATEGORIES)[number]["id"]

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as CategoryId[]

export const categoryById = (id: string) => CATEGORIES.find((c) => c.id === id)
