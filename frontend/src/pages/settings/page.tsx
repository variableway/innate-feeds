import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  fetchAppSettings,
  updateAppSettings,
  type AppSettings,
} from "@/services/feeds";

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [readmesDir, setReadmesDir] = useState("readmes");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAppSettings()
      .then((s) => {
        if (cancelled) return;
        setSettings(s);
        setReadmesDir(s.readmesDir);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load settings");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onSave = async () => {
    setSaving(true);
    try {
      const next = await updateAppSettings({ readmesDir: readmesDir.trim() });
      setSettings(next);
      setReadmesDir(next.readmesDir);
      toast.success("Settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 p-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure where fetched repository READMEs are stored on disk.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Settings unavailable</p>
          <p className="mt-1">{error}</p>
        </div>
      ) : (
        <section className="space-y-4 rounded-lg border p-4">
          <div>
            <h2 className="text-sm font-medium">README cache directory</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Relative paths resolve against the project root. Absolute paths
              are used as-is. Files are written as{" "}
              <code className="rounded bg-muted px-1 py-0.5">
                {"{owner}/{repo}.md"}
              </code>
              .
            </p>
          </div>

          <label className="block space-y-1.5 text-sm">
            <span className="text-muted-foreground">Directory</span>
            <input
              type="text"
              value={readmesDir}
              onChange={(e) => setReadmesDir(e.target.value)}
              placeholder="readmes"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          {settings && (
            <dl className="space-y-2 text-xs text-muted-foreground">
              <div>
                <dt className="font-medium text-foreground">Resolved path</dt>
                <dd className="mt-0.5 break-all font-mono">
                  {settings.readmesDirResolved}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Config file</dt>
                <dd className="mt-0.5 break-all font-mono">
                  {settings.configPath}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Example file</dt>
                <dd className="mt-0.5 break-all font-mono">
                  {settings.readmesDirResolved}/practical-tutorials/project-based-learning.md
                </dd>
              </div>
            </dl>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              disabled={saving || !readmesDir.trim()}
              onClick={onSave}
              className="rounded-md border border-primary bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
