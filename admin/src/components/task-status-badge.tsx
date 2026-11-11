/**
 * 任务运行状态徽章（issue #70）。
 * status → 视觉映射：running=primary 呼吸点、success=success、failed/destructive、
 * cancelled/interrupted=muted。
 */
import { Badge, Spinner } from "@innate/ui";
import type { TaskRunStatus } from "@/types/tasks";

const STATUS_LABEL: Record<TaskRunStatus, string> = {
  running: "运行中",
  success: "成功",
  failed: "失败",
  cancelled: "已取消",
  interrupted: "已中断",
};

export function statusBadgeVariant(
  status: TaskRunStatus,
): "default" | "secondary" | "destructive" | "muted" | "outline" {
  switch (status) {
    case "running":
      return "default";
    case "success":
      return "outline";
    case "failed":
      return "destructive";
    case "cancelled":
    case "interrupted":
      return "muted";
  }
}

export function TaskStatusBadge({ status }: { status: TaskRunStatus }) {
  return (
    <Badge variant={statusBadgeVariant(status)} className="gap-1">
      {status === "running" ? <Spinner className="size-2.5" /> : null}
      {STATUS_LABEL[status]}
    </Badge>
  );
}
