/**
 * 采集任务可视化后台（issue #70）：SYNC_JOBS 注册表 → 可操作的后台任务。
 *
 *   - 任务列表：手动触发 / 取消、上次运行状态、调度配置入口
 *   - 运行历史：状态 / 触发方式 / 耗时 / 日志查看（含取消）
 *   - 定时调度：每 job 独立间隔（5 ~ 10080 分钟）
 *
 * 数据全部来自 `/api/admin/tasks/*`（backend/src/app/admin-tasks.ts）。
 * 有任务运行时 5s 轮询，空闲 15s。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Ban,
  Clock,
  ListChecks,
  Play,
  RefreshCw,
  ScrollText,
  TimerReset,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@innate/ui";
import PageContainer from "@innate/admin-composites/page-container";
import {
  cancelRun,
  fetchJobs,
  fetchRuns,
  runJob,
} from "@/services/admin-tasks";
import type { AdminTaskJob, TaskRun } from "@/types/tasks";
import { formatDuration, formatRelative } from "@/lib/utils";
import { TaskStatusBadge } from "@/components/task-status-badge";
import { RunLogDialog } from "@/components/run-log-dialog";
import { ScheduleDialog } from "@/components/schedule-dialog";

const GROUP_LABEL: Record<string, string> = {
  core: "GitHub 核心",
  external: "外部源",
  topics: "Topics",
  vertical: "垂直域",
  pipeline: "流水线",
};

function StatCard({
  title,
  value,
  hint,
  icon: Icon,
}: {
  title: string;
  value: string;
  hint: string;
  icon: typeof ListChecks;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
          <Icon className="size-3.5" />
          {title}
        </CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums">
          {value}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-xs">{hint}</p>
      </CardContent>
    </Card>
  );
}

export function TasksPage() {
  const [jobs, setJobs] = useState<AdminTaskJob[] | null>(null);
  const [runs, setRuns] = useState<TaskRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyJobId, setBusyJobId] = useState<string | null>(null);
  const [cancellingRunId, setCancellingRunId] = useState<string | null>(null);
  const [logRunId, setLogRunId] = useState<string | null>(null);
  const [scheduleJob, setScheduleJob] = useState<AdminTaskJob | null>(null);

  const load = useCallback(async () => {
    try {
      const [jobsRes, runsRes] = await Promise.all([
        fetchJobs(),
        fetchRuns({ limit: 50 }),
      ]);
      setJobs(jobsRes.jobs);
      setRuns(runsRes.runs);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // 有任务在跑 → 5s 轮询；空闲 → 15s 心跳（定时调度可能随时启动）
  const hasRunning = jobs?.some((job) => job.running) ?? false;
  useEffect(() => {
    const timer = setInterval(() => void load(), hasRunning ? 5000 : 15000);
    return () => clearInterval(timer);
  }, [hasRunning, load]);

  const stats = useMemo(() => {
    const running = jobs?.filter((job) => job.running).length ?? 0;
    const scheduled = jobs?.filter((job) => job.schedule?.enabled).length ?? 0;
    const recent = runs.slice(0, 20);
    const success = recent.filter((run) => run.status === "success").length;
    const failed = recent.filter(
      (run) => run.status === "failed" || run.status === "interrupted",
    ).length;
    return {
      total: jobs?.length ?? 0,
      running,
      scheduled,
      success,
      failed,
    };
  }, [jobs, runs]);

  const handleRun = async (job: AdminTaskJob) => {
    setBusyJobId(job.id);
    try {
      await runJob(job.id);
      toast.success(`已启动 ${job.id}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyJobId(null);
    }
  };

  const handleCancel = async (runId: string) => {
    setCancellingRunId(runId);
    try {
      await cancelRun(runId);
      toast.success("已发送取消信号");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setCancellingRunId(null);
    }
  };

  return (
    <PageContainer
      pageTitle="采集任务"
      pageDescription="M-Sync 任务注册表 · 手动触发 · 运行日志 · 定时调度"
      isLoading={!jobs && !error}
      pageHeaderAction={
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="size-3.5" />
          刷新
        </Button>
      }
    >
      {error ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <p className="text-destructive text-sm">无法加载任务列表：{error}</p>
          <p className="text-muted-foreground text-xs">
            请确认后端已启动（bun run dev:backend），且 admin 后台未被
            --no-admin / ADMIN_DB_UI=off 关闭。
          </p>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            重试
          </Button>
        </div>
      ) : (
        <>
          {/* 概览指标 */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              title="任务总数"
              value={String(stats.total)}
              hint="SYNC_JOBS 注册表中的采集任务"
              icon={ListChecks}
            />
            <StatCard
              title="运行中"
              value={String(stats.running)}
              hint={hasRunning ? "正在采集，5s 自动刷新" : "当前无运行中的任务"}
              icon={Play}
            />
            <StatCard
              title="定时启用"
              value={String(stats.scheduled)}
              hint="已配置定时自动运行的任务"
              icon={TimerReset}
            />
            <StatCard
              title="近 20 次运行"
              value={`${stats.success} / ${stats.failed}`}
              hint="成功 / 失败（含中断）"
              icon={Clock}
            />
          </div>

          <Tabs defaultValue="jobs" className="mt-6">
            <TabsList>
              <TabsTrigger value="jobs">任务</TabsTrigger>
              <TabsTrigger value="runs">运行历史</TabsTrigger>
            </TabsList>

            {/* ---------------- 任务列表 ---------------- */}
            <TabsContent value="jobs" className="mt-4">
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>任务</TableHead>
                      <TableHead>分组</TableHead>
                      <TableHead>产出</TableHead>
                      <TableHead>上次运行</TableHead>
                      <TableHead>调度</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(jobs ?? []).map((job) => (
                      <TableRow key={job.id}>
                        <TableCell>
                          <div className="font-medium">{job.id}</div>
                          <div className="text-muted-foreground text-xs">
                            {job.summary}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="muted">
                            {GROUP_LABEL[job.group] ?? job.group}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-muted-foreground font-mono text-xs">
                            {job.outputs}
                          </span>
                        </TableCell>
                        <TableCell>
                          {job.lastRun ? (
                            <button
                              type="button"
                              className="flex flex-col items-start gap-0.5 text-left"
                              onClick={() => setLogRunId(job.lastRun!.id)}
                            >
                              <TaskStatusBadge status={job.lastRun.status} />
                              <span className="text-muted-foreground text-xs">
                                {formatRelative(job.lastRun.startedAt)}
                              </span>
                            </button>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              从未运行
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {job.schedule?.enabled ? (
                            <Badge variant="secondary">
                              每 {job.schedule.everyMinutes} 分钟
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              未启用
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1.5">
                            {job.running ? (
                              <Button
                                variant="destructive"
                                size="xs"
                                disabled={cancellingRunId === job.runningRunId}
                                onClick={() =>
                                  job.runningRunId &&
                                  void handleCancel(job.runningRunId)
                                }
                              >
                                <Ban className="size-3" />
                                取消
                              </Button>
                            ) : (
                              <Button
                                size="xs"
                                disabled={busyJobId === job.id}
                                onClick={() => void handleRun(job)}
                              >
                                <Play className="size-3" />
                                运行
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="xs"
                              disabled={!job.lastRun}
                              onClick={() =>
                                job.lastRun && setLogRunId(job.lastRun.id)
                              }
                            >
                              <ScrollText className="size-3" />
                              日志
                            </Button>
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => setScheduleJob(job)}
                            >
                              <Clock className="size-3" />
                              调度
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* ---------------- 运行历史 ---------------- */}
            <TabsContent value="runs" className="mt-4">
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>任务</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>触发</TableHead>
                      <TableHead>启动时间</TableHead>
                      <TableHead>耗时</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-muted-foreground py-10 text-center"
                        >
                          暂无运行记录——在「任务」页手动触发一次试试
                        </TableCell>
                      </TableRow>
                    ) : (
                      runs.map((run) => (
                        <TableRow key={run.id}>
                          <TableCell className="font-mono text-xs">
                            {run.jobId}
                          </TableCell>
                          <TableCell>
                            <TaskStatusBadge status={run.status} />
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {run.trigger === "manual" ? "手动" : "定时"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {formatRelative(run.startedAt)}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {formatDuration(run.startedAt, run.finishedAt)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="outline"
                                size="xs"
                                onClick={() => setLogRunId(run.id)}
                              >
                                <ScrollText className="size-3" />
                                日志
                              </Button>
                              {run.status === "running" ? (
                                <Button
                                  variant="destructive"
                                  size="xs"
                                  disabled={cancellingRunId === run.id}
                                  onClick={() => void handleCancel(run.id)}
                                >
                                  <Ban className="size-3" />
                                  取消
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>

          <RunLogDialog
            runId={logRunId}
            onClose={() => {
              setLogRunId(null);
              void load();
            }}
          />
          <ScheduleDialog
            job={scheduleJob}
            onClose={() => setScheduleJob(null)}
            onSaved={() => void load()}
          />
        </>
      )}
    </PageContainer>
  );
}
