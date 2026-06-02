import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, KeyRound, Plus, Trash2 } from "lucide-react";
import { apiKeyAPI } from "@/lib/api";
import type { APIKey } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";

export function ApiKeysContent() {
  const { t } = useI18n();
  const [keys, setKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const res = await apiKeyAPI.list();
      setKeys(res.data?.data ?? []);
    } catch {
      toast.error(t("settings.apiKeys.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    setIsCreating(true);
    try {
      const res = await apiKeyAPI.create({ name: newKeyName.trim() });
      if (res.data?.data?.api_key) {
        setCreatedKey(res.data.data.api_key);
        setNewKeyName("");
        fetchKeys();
      }
    } catch {
      toast.error(t("settings.apiKeys.createError"));
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiKeyAPI.delete(id);
      setKeys((prev) => prev.filter((k) => k.id !== id));
      toast.success(t("settings.apiKeys.deleteSuccess"));
    } catch {
      toast.error(t("settings.apiKeys.deleteError"));
    }
  };

  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(key).then(() => {
      toast.success(t("settings.apiKeys.copied"));
    });
  };

  return (
    <div className="space-y-5">
      {/* Create new key */}
      <div className="space-y-2">
        <p className="text-sm font-medium">{t("settings.apiKeys.createTitle")}</p>
        <p className="text-[13px] text-muted-foreground">
          {t("settings.apiKeys.createDescription")}
        </p>
        <div className="flex gap-2">
          <Input
            placeholder={t("settings.apiKeys.namePlaceholder")}
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreate();
            }}
            className="flex-1"
          />
          <Button
            onClick={() => void handleCreate()}
            disabled={isCreating || !newKeyName.trim()}
          >
            <Plus className="h-4 w-4 mr-1" />
            {t("settings.apiKeys.create")}
          </Button>
        </div>
      </div>

      {/* Key list */}
      <div className="space-y-2">
        <p className="text-sm font-medium">{t("settings.apiKeys.listTitle")}</p>
        {loading && keys.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : keys.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("settings.apiKeys.empty")}
          </p>
        ) : (
          <div className="space-y-2">
            {keys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {key.name || t("settings.apiKeys.unnamed")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("settings.apiKeys.created")}: {formatDate(key.created_at)}
                      {key.last_used_at > 0 && (
                        <>
                          {" · "}
                          {t("settings.apiKeys.lastUsed")}: {formatDate(key.last_used_at)}
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => void handleDelete(key.id)}
                  className="shrink-0 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Show created key dialog */}
      <Dialog open={!!createdKey} onOpenChange={() => setCreatedKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settings.apiKeys.createdTitle")}</DialogTitle>
            <DialogDescription>
              {t("settings.apiKeys.createdDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-muted px-2 py-1.5 text-sm break-all">
              {createdKey}
            </code>
            <Button variant="outline" size="icon-sm" onClick={() => createdKey && handleCopy(createdKey)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
