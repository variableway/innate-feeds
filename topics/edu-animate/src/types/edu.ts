/**
 * 教育动画域的前端类型。
 *
 * 后端两个 external source 的原始条目都是 `ExternalFeedItem`
 * （backend/src/collector/shared/types.ts），metadata 是 `Record<string, unknown>`。
 * 服务层负责把原始条目收敛成本文件里的两个视图模型，
 * 页面只面对收敛后的类型，不做 defensive parsing。
 */

/** 与后端 ExternalFeedItem 对齐的最小子集（只声明本域用到的字段）。 */
export interface RawExternalItem {
  id: string;
  source: string;
  title: string;
  tagline: string;
  description: string;
  url: string;
  externalUrl: string | null;
  imageUrl: string | null;
  categories: string[];
  metrics: {
    score?: number;
    comments?: number;
    stars?: number;
    downloads?: number;
    forks?: number;
  };
  metadata: Record<string, unknown>;
  fetchedAt: string;
  publishedAt: string | null;
}

/** 外部源快照（对应 /api/external/:source 的返回体）。 */
export interface ExternalSourcePayload {
  source: string;
  title: string;
  description: string;
  label: string;
  fetchedAt: string;
  count: number;
  items: RawExternalItem[];
}

/** 领域相关度：core = 教育动画主链路；related = 泛动效/周边。 */
export type EduRelevance = "core" | "related";

/** 一个教育动画领域的 Agent Skill。 */
export interface EduSkill {
  id: string;
  /** 可读标题（由 slug titleize 得到） */
  title: string;
  /** 一句话说明 */
  tagline: string;
  /** 完整描述（skills.sh 详情页 JSON-LD 的 description） */
  description: string;
  /** skills.sh 详情页 */
  url: string;
  /** GitHub 仓库 */
  repoUrl: string;
  owner: string;
  repo: string;
  /** skills.sh 里的 skill 名（安装用） */
  skill: string;
  relevance: EduRelevance;
  /** skills.sh 安装量 */
  installs: number;
  /** GitHub stars（无 token 时为 null） */
  stars: number | null;
  license: string | null;
  topics: string[];
  archived: boolean;
  repoUpdatedAt: string | null;
  /** 安装命令（复制即用） */
  installCommand: string;
  categories: string[];
  fetchedAt: string;
  publishedAt: string | null;
}

/** 一个教育动画领域的教学视频（只含元数据与链接）。 */
export interface EduVideo {
  id: string;
  title: string;
  description: string;
  /** YouTube 观看页 */
  url: string;
  thumbnail: string | null;
  channelTitle: string;
  /** 策展来源 id */
  feedId: string;
  feedTitle: string;
  durationSeconds: number | null;
  views: number | null;
  likes: number | null;
  categories: string[];
  publishedAt: string | null;
  /** 来源平台（B14：bilibili 合流） */
  platform?: "youtube" | "bilibili";
  /** 策展者对这个来源的说明 */
  note: string | null;
}

/** 路由 search 参数（URL 上的状态）。 */
export interface EduSearch {
  q?: string;
  category?: string;
  relevance?: string;
  sort?: string;
  page?: number;
}

/** 列表查询参数（API 与静态模式共用同一套语义）。 */
export interface EduQuery {
  /** 关键词：匹配标题/描述/仓库名/skill 名 */
  q?: string;
  /** 分类 id（见 shared/edu-categories.ts） */
  category?: string;
  /** 相关度筛选（仅 skills） */
  relevance?: EduRelevance;
  /** 排序键 */
  sort?: string;
  page?: number;
  perPage?: number;
}

/** 分页结果。 */
export interface EduPage<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
}

/** 分类及其计数。 */
export interface EduCategoryCount {
  id: string;
  label: string;
  labelZh: string;
  emoji: string;
  count: number;
}
