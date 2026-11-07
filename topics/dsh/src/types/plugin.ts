/**
 * DSH plugin types.
 * S0：DshPlugin 契约收敛至根 shared/types/plugins，此处 re-export。
 */

export type { DshPlugin } from "../../../../shared/types/plugins";

export interface PluginSearchResult {
  items: import("../../../../shared/types/plugins").DshPlugin[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
}

export interface PluginCategoryStat {
  id: string;
  label: string;
  labelZh: string;
  emoji: string;
  count: number;
}

export interface PluginStats {
  total: number;
  categories: number;
}
