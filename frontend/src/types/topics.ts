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
export type TopicsIndex =
  import("../../../shared/types/topics").TopicsIndexResponse;

export type TopicSort = "stars" | "updated" | "new";

/**
 * issue #68：Topic 查询分类表（分类 → 步骤/子类 两级），shared 单一真相。
 * `/topics` 分组查询 UI 消费（task-04）。
 */
export {
  TOPIC_QUERY_CATEGORIES,
  ALL_QUERY_TOPICS,
  QUERY_GROUP_BY_ID,
  QUERY_GROUP_OF_TOPIC,
} from "../../../shared/topic-query-groups";
export type {
  TopicQueryCategory,
  TopicQueryGroup,
} from "../../../shared/topic-query-groups";
