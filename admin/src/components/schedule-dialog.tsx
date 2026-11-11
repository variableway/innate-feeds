/**
 * 定时调度对话框（issue #70）：为单个 job 设置定时自动运行。
 * 间隔 5 ~ 10080 分钟（一周），开关 + 预设快捷档 + 手动输入。
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Switch,
} from "@innate/ui";
import { clearSchedule, saveSchedule } from "@/services/admin-tasks";
import type { AdminTaskJob } from "@/types/tasks";
import { formatRelative } from "@/lib/utils";

const PRESET_MINUTES = [
  { label: "30 分钟", value: 30 },
  { label: "1 小时", value: 60 },
  { label: "6 小时", value: 360 },
  { label: "24 小时", value: 1440 },
];

export function ScheduleDialog({
  job,
  onClose,
  onSaved,
}: {
  job: AdminTaskJob | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [enabled, setEnabled] = useState(false);
  const [everyMinutes, setEveryMinutes] = useState("60");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!job) return;
    setEnabled(job.schedule?.enabled ?? false);
    setEveryMinutes(String(job.schedule?.everyMinutes ?? 60));
  }, [job]);

  const minutes = Number(everyMinutes);
  const valid = Number.isInteger(minutes) && minutes >= 5 && minutes <= 10080;

  const handleSave = async () => {
    if (!job || !valid) return;
    setSaving(true);
    try {
      await saveSchedule(job.id, { enabled, everyMinutes: minutes });
      toast.success(enabled ? "已开启定时运行" : "已保存调度配置");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!job) return;
    setSaving(true);
    try {
      await clearSchedule(job.id);
      toast.success("已清除调度配置");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!job} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>定时自动运行</DialogTitle>
          <DialogDescription>
            {job ? `${job.id} · ${job.summary}` : null}
            {job?.schedule?.lastStartedAt
              ? ` · 上次启动 ${formatRelative(job.schedule.lastStartedAt)}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="schedule-enabled" className="text-sm font-medium">
              启用定时运行
            </Label>
            <Switch
              id="schedule-enabled"
              checked={enabled}
              onCheckedChange={(checked) => setEnabled(checked)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="schedule-interval" className="text-sm font-medium">
              运行间隔（分钟）
            </Label>
            <Input
              id="schedule-interval"
              type="number"
              min={5}
              max={10080}
              value={everyMinutes}
              onChange={(e) => setEveryMinutes(e.target.value)}
            />
            <div className="flex flex-wrap gap-1.5">
              {PRESET_MINUTES.map((preset) => (
                <Button
                  key={preset.value}
                  variant={minutes === preset.value ? "secondary" : "outline"}
                  size="xs"
                  onClick={() => setEveryMinutes(String(preset.value))}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            {!valid ? (
              <p className="text-destructive text-xs">
                间隔需为 5 ~ 10080 之间的整数分钟
              </p>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={() => void handleClear()}
          >
            清除
          </Button>
          <Button
            size="sm"
            disabled={saving || !valid}
            onClick={() => void handleSave()}
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
