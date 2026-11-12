/**
 * 运行日志对话框（issue #70）：展示单次运行的记录 + 日志尾部。
 * 运行中每 2s 轮询刷新日志，结束即停。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Skeleton,
} from "@innate/ui";
import { cancelRun, fetchRunDetail } from "@/services/admin-tasks";
import type { RunDetail } from "@/types/tasks";
import { formatDateTime, formatDuration } from "@/lib/utils";
import { TaskStatusBadge } from "./task-status-badge";

export function RunLogDialog({
  runId,
  onClose,
}: {
  runId: string | null;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const logRef = useRef<HTMLPreElement>(null);
  /** 用户滚到顶部查看历史时不要强行拽回底部。 */
  const stickToBottom = useRef(true);

  const load = useCallback(async () => {
    if (!runId) return;
    try {
      setDetail(await fetchRunDetail(runId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [runId]);

  useEffect(() => {
    setDetail(null);
    setError(null);
    stickToBottom.current = true;
    if (!runId) return;
    void load();
  }, [runId, load]);

  // 日志增长时跟随到底部（用户主动上翻后不再打扰）。
  useEffect(() => {
    const element = logRef.current;
    if (!element || !stickToBottom.current) return;
    element.scrollTop = element.scrollHeight;
  }, [detail?.log]);

  const handleLogScroll = () => {
    const element = logRef.current;
    if (!element) return;
    stickToBottom.current =
      element.scrollHeight - element.scrollTop - element.clientHeight < 24;
  };

  const running = detail?.run.status === "running";
  useEffect(() => {
    if (!runId || !running) return;
    const timer = setInterval(() => void load(), 2000);
    return () => clearInterval(timer);
  }, [runId, running, load]);

  const handleCancel = async () => {
    if (!detail) return;
    setCancelling(true);
    try {
      await cancelRun(detail.run.id);
      toast.success("已发送取消信号");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setCancelling(false);
    }
  };

  const run = detail?.run;

  return (
    <Dialog open={!!runId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {running ? "实时日志" : "运行日志"}
            {run ? <TaskStatusBadge status={run.status} /> : null}
            {running ? (
              <Badge variant="secondary" className="gap-1">
                每 2s 刷新
              </Badge>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            {run
              ? `${run.jobId} · ${formatDateTime(run.startedAt)} · 耗时 ${formatDuration(
                  run.startedAt,
                  run.finishedAt,
                )}${run.exitCode != null ? ` · exit ${run.exitCode}` : ""}`
              : runId}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : !detail ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : (
          <pre
            ref={logRef}
            onScroll={handleLogScroll}
            className="min-h-0 flex-1 overflow-auto rounded-lg border bg-code p-3 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-code-foreground"
          >
            {detail.log || "（暂无日志输出）"}
          </pre>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {run ? (
              <Badge variant="muted">
                {run.trigger === "manual" ? "手动触发" : "定时触发"}
              </Badge>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {running ? (
              <Button
                variant="destructive"
                size="sm"
                disabled={cancelling}
                onClick={() => void handleCancel()}
              >
                取消运行
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => void load()}>
              刷新
            </Button>
            <Button size="sm" onClick={onClose}>
              关闭
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
