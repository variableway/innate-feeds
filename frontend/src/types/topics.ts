/**
 * GitHub Topics datasource types (GH #24).
 * S0：wire 契约（TopicRepo / TopicSummary / TopicsIndexResponse / TopicResponse）
 * 收敛至根 shared/types/topics，此处 re-export；TopicDetail / TopicsIndex
 * 保留旧名作为别名，前端调用点零改动。
 */

export type {
  TopicRepo,
  TopicSummary,
  TopicsIndexResponse,
  TopicResponse,
} from "../../../shared/types/topics";

/** 旧名别名：详情响应。 */
export type TopicDetail = import("../../../shared/types/topics").TopicResponse;

/** 旧名别名：索引响应。 */
export type TopicsIndex = import("../../../shared/types/topics").TopicsIndexResponse;

export type TopicSort = "stars" | "updated" | "new";
