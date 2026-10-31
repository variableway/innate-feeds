import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { sql as sqlLanguage } from "@codemirror/lang-sql";
import {
  BookMarked,
  ChevronLeft,
  ChevronRight,
  Database,
  FileJson,
  PanelRightClose,
  Play,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  createSavedQuery,
  deleteSavedQuery,
  fetchAdminTables,
  fetchJsonFiles,
  fetchSavedQueries,
  fetchTableSchema,
  runAdminQuery,
  scanJsonFiles,
  updateSavedQuery,
  type AdminDbJsonFile,
  type AdminDbQueryResult,
  type AdminDbSavedQuery,
  type AdminDbTable,
  type AdminDbTableSchema,
} from "@/services/admin-db";

function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

function tablePreviewSql(name: string): string {
  return `SELECT * FROM "${name}" LIMIT 100`;
}

const SCHEMA_PAGE_SIZE = 15;

function previewValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "object") {
    const json = JSON.stringify(value);
    return json.length > 120 ? `${json.slice(0, 120)}…` : json;
  }
  const text = String(value);
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}

export function AdminPage() {
  const [tables, setTables] = useState<AdminDbTable[]>([]);
  const [tablesError, setTablesError] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableSchema, setTableSchema] = useState<AdminDbTableSchema | null>(
    null,
  );
  const [schemaPage, setSchemaPage] = useState(1);

  const [sqlText, setSqlText] = useState(
    "SELECT s.full_name, s.stars, s.language,\n       GROUP_CONCAT(t.topic) AS topics\nFROM starred_repos s\nJOIN starred_repo_topics t ON t.repo_id = s.id\nWHERE t.topic LIKE '%agent%'\n  AND s.stars > 10000\nGROUP BY s.id\nORDER BY s.stars DESC",
  );
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AdminDbQueryResult | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [resultPage, setResultPage] = useState(1);
  const [resultPageSize, setResultPageSize] = useState(30);

  const [savedQueries, setSavedQueries] = useState<AdminDbSavedQuery[]>([]);
  const [activeSavedId, setActiveSavedId] = useState<number | null>(null);
  const [savingName, setSavingName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const drawerWrapRef = useRef<HTMLDivElement>(null);

  const [jsonFiles, setJsonFiles] = useState<AdminDbJsonFile[]>([]);
  const [scanning, setScanning] = useState(false);

  const runQuery = useCallback(
    async (text?: string) => {
      const query = (text ?? sqlText).trim();
      if (!query) return;
      setRunning(true);
      setQueryError(null);
      try {
        const res = await runAdminQuery(query);
        setResult(res);
        setResultPage(1);
      } catch (err) {
        setQueryError(err instanceof Error ? err.message : "查询失败");
      } finally {
        setRunning(false);
      }
    },
    [sqlText],
  );

  const loadTables = useCallback(async () => {
    try {
      const { tables: list } = await fetchAdminTables();
      setTables(list);
      setTablesError(null);
    } catch (err) {
      setTablesError(
        err instanceof Error
          ? err.message
          : "无法连接 admin API（需要 API 模式后端）",
      );
    }
  }, []);

  const loadSavedQueries = useCallback(async () => {
    try {
      const { queries } = await fetchSavedQueries();
      setSavedQueries(queries);
    } catch {
      // Non-fatal: the saved-SQL column just stays empty.
    }
  }, []);

  const loadJsonFiles = useCallback(async () => {
    try {
      const { files } = await fetchJsonFiles();
      setJsonFiles(files);
    } catch {
      setJsonFiles([]);
    }
  }, []);

  useEffect(() => {
    loadTables();
    loadSavedQueries();
    loadJsonFiles();
  }, [loadTables, loadSavedQueries, loadJsonFiles]);

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        runQuery();
      }
      if (event.key === "Escape" && savedOpen) {
        event.preventDefault();
        setSavedOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [runQuery, savedOpen]);

  // 部分内嵌浏览器不推进 CSS 过渡（transition 永远 pending），
  // 两帧后仍未启动的过渡直接取消、瞬时落位，保证抽屉开合可用。
  useEffect(() => {
    const wrap = drawerWrapRef.current;
    if (!wrap) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const els = [wrap, ...Array.from(wrap.querySelectorAll("*"))];
        for (const el of els) {
          for (const anim of el.getAnimations()) {
            if (anim.startTime === null) anim.cancel();
          }
        }
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [savedOpen]);

  const selectTable = async (name: string): Promise<void> => {
    setSelectedTable(name);
    setSqlText(tablePreviewSql(name));
    setActiveSavedId(null);
    setSchemaPage(1);
    try {
      setTableSchema(await fetchTableSchema(name));
    } catch {
      setTableSchema(null);
    }
  };

  const loadSaved = (saved: AdminDbSavedQuery): void => {
    setSqlText(saved.sql);
    setActiveSavedId(saved.id);
    setSelectedTable(null);
    setTableSchema(null);
  };

  const saveCurrent = async (asNew: boolean): Promise<void> => {
    const name =
      savingName.trim() ||
      savedQueries.find((q) => q.id === activeSavedId)?.name ||
      "";
    if (!name) {
      setShowSaveInput(true);
      toast.error("请输入保存名称");
      return;
    }
    try {
      if (!asNew && activeSavedId !== null) {
        await updateSavedQuery(activeSavedId, { name, sql: sqlText });
        toast.success("已更新保存的 SQL");
      } else {
        const { query } = await createSavedQuery({ name, sql: sqlText });
        setActiveSavedId(query.id);
        toast.success("已保存 SQL");
      }
      setSavingName("");
      setShowSaveInput(false);
      await loadSavedQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败");
    }
  };

  const removeSaved = async (id: number): Promise<void> => {
    try {
      await deleteSavedQuery(id);
      if (activeSavedId === id) setActiveSavedId(null);
      await loadSavedQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败");
    }
  };

  const rescanJson = async (): Promise<void> => {
    setScanning(true);
    try {
      const stats = await scanJsonFiles();
      toast.success(
        `JSON 扫描完成：${stats.fileCount} 个文件（跳过 ${stats.skipped}）`,
      );
      await loadJsonFiles();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "扫描失败");
    } finally {
      setScanning(false);
    }
  };

  const userTables = useMemo(() => tables.filter((t) => !t.internal), [tables]);

  const schemaColumns = tableSchema?.columns ?? [];
  const schemaTotalPages = Math.max(
    1,
    Math.ceil(schemaColumns.length / SCHEMA_PAGE_SIZE),
  );
  const schemaCurrentPage = Math.min(schemaPage, schemaTotalPages);
  const schemaPageColumns = schemaColumns.slice(
    (schemaCurrentPage - 1) * SCHEMA_PAGE_SIZE,
    schemaCurrentPage * SCHEMA_PAGE_SIZE,
  );

  const resultRows = result?.rows ?? [];
  const totalResultRows = resultRows.length;
  const totalPages =
    resultPageSize === 0
      ? 1
      : Math.max(1, Math.ceil(totalResultRows / resultPageSize));
  const currentPage = Math.min(resultPage, totalPages);
  const pagedRows =
    resultPageSize === 0
      ? resultRows
      : resultRows.slice(
          (currentPage - 1) * resultPageSize,
          currentPage * resultPageSize,
        );

  const darkMode =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">SQLite 工作台</h1>
          <p className="text-muted-foreground text-xs">
            只读查询 · Ctrl/Cmd + Enter 执行 · 结果上限 500 行
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSavedOpen((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs ${
            savedOpen
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title="打开/收起保存的 SQL 面板"
        >
          <BookMarked className="h-3.5 w-3.5" />
          保存的 SQL（{savedQueries.length}）
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 gap-3">
        {/* Left: tables + JSON registry */}
        <aside className="flex w-56 shrink-0 flex-col gap-2 overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col rounded-md border">
            <div className="text-muted-foreground flex items-center gap-1.5 border-b px-2 py-1.5 text-xs font-medium">
              <Database className="h-3.5 w-3.5" />
              表（{userTables.length}）
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-1">
              {tablesError && (
                <p className="text-destructive px-2 py-1 text-xs">
                  {tablesError}
                </p>
              )}
              {userTables.map((table) => (
                <button
                  key={table.name}
                  type="button"
                  onClick={() => selectTable(table.name)}
                  onDoubleClick={() => {
                    void selectTable(table.name);
                    void runQuery(tablePreviewSql(table.name));
                  }}
                  title="单击填入 SQL，双击直接执行"
                  className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs hover:bg-accent ${
                    selectedTable === table.name ? "bg-accent" : ""
                  }`}
                >
                  <span className="truncate font-mono">{table.name}</span>
                  <span className="text-muted-foreground ml-2 shrink-0 tabular-nums">
                    {formatCount(table.rowCount)}
                  </span>
                </button>
              ))}
            </div>
            {tableSchema && (
              <div className="border-t p-2">
                <div className="text-muted-foreground mb-1 flex items-center justify-between text-[10px] font-medium uppercase">
                  <span>
                    {tableSchema.table} 列（{schemaColumns.length}）
                  </span>
                  {schemaTotalPages > 1 && (
                    <span className="flex items-center gap-1 normal-case">
                      <button
                        type="button"
                        onClick={() => setSchemaPage((p) => Math.max(1, p - 1))}
                        disabled={schemaCurrentPage <= 1}
                        className="hover:text-foreground inline-flex items-center disabled:opacity-40"
                        title="上一页"
                      >
                        <ChevronLeft className="h-3 w-3" />
                      </button>
                      <span className="tabular-nums">
                        {schemaCurrentPage}/{schemaTotalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setSchemaPage((p) =>
                            Math.min(schemaTotalPages, p + 1),
                          )
                        }
                        disabled={schemaCurrentPage >= schemaTotalPages}
                        className="hover:text-foreground inline-flex items-center disabled:opacity-40"
                        title="下一页"
                      >
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                </div>
                {schemaPageColumns.map((col) => (
                  <div
                    key={col.name}
                    className="flex items-baseline justify-between gap-2 text-[11px]"
                  >
                    <span className="truncate font-mono">{col.name}</span>
                    <span className="text-muted-foreground shrink-0">
                      {col.type}
                      {col.pk ? " ·PK" : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-md border p-2">
            <div className="text-muted-foreground mb-1 flex items-center justify-between text-xs font-medium">
              <span className="flex items-center gap-1.5">
                <FileJson className="h-3.5 w-3.5" />
                JSON 文件（{jsonFiles.length}）
              </span>
              <button
                type="button"
                onClick={rescanJson}
                disabled={scanning}
                className="hover:text-foreground inline-flex items-center gap-1 disabled:opacity-50"
                title="扫描 ~/.innate（ADMIN_JSON_DIR 可覆盖）并注册到 json_documents"
              >
                <RefreshCw
                  className={`h-3 w-3 ${scanning ? "animate-spin" : ""}`}
                />
                扫描
              </button>
            </div>
            <p className="text-muted-foreground text-[11px] leading-snug">
              扫描后可在 SQL 中查询
              <code className="mx-1 font-mono">json_documents</code>
              配合
              <code className="mx-1 font-mono">json_each</code>
            </p>
          </div>
        </aside>

        {/* Center: editor + results */}
        <section className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border">
            <div className="bg-muted/40 flex items-center justify-between border-b px-2 py-1">
              <span className="text-muted-foreground text-xs font-medium">
                SQL 编辑器
              </span>
              <div className="flex items-center gap-1.5">
                {showSaveInput && (
                  <input
                    value={savingName}
                    onChange={(event) => setSavingName(event.target.value)}
                    placeholder="保存名称"
                    className="bg-background h-6 w-36 rounded border px-2 text-xs"
                    autoFocus
                  />
                )}
                <button
                  type="button"
                  onClick={() => setShowSaveInput((v) => !v)}
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
                >
                  <Save className="h-3.5 w-3.5" />
                  {activeSavedId !== null ? "覆盖保存" : "保存"}
                </button>
                {activeSavedId !== null && (
                  <button
                    type="button"
                    onClick={() => saveCurrent(true)}
                    className="text-muted-foreground hover:text-foreground text-xs"
                  >
                    另存
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => runQuery()}
                  disabled={running}
                  className="inline-flex items-center gap-1 rounded bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  <Play className="h-3 w-3" />
                  {running ? "执行中…" : "运行"}
                </button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 overflow-hidden">
              <CodeMirror
                value={sqlText}
                height="100%"
                className="h-full w-full min-w-0"
                theme={darkMode ? "dark" : "light"}
                extensions={[sqlLanguage()]}
                basicSetup={{
                  foldGutter: false,
                  searchKeymap: false,
                  autocompletion: true,
                }}
                onChange={setSqlText}
              />
            </div>
          </div>

          {queryError && (
            <div className="text-destructive rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs">
              {queryError}
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border">
            <div className="bg-muted/40 text-muted-foreground flex items-center justify-between border-b px-2 py-1 text-xs">
              <span>结果</span>
              {result && (
                <span className="tabular-nums">
                  {formatCount(result.rowCount)} 行 ·{" "}
                  {result.durationMs.toFixed(1)} ms
                  {result.truncated
                    ? ` · 已截断（上限 ${formatCount(result.rowLimit)}）`
                    : ""}
                </span>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              {result && result.rows.length > 0 ? (
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="bg-muted/20 sticky top-0">
                    <tr>
                      {result.columns.map((column) => (
                        <th
                          key={column}
                          className="text-muted-foreground border-b px-2 py-1.5 font-medium whitespace-nowrap"
                        >
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRows.map((row, index) => (
                      <tr key={index} className="hover:bg-accent/40">
                        {result.columns.map((column) => (
                          <td
                            key={column}
                            className={`border-b px-2 py-1 align-top whitespace-nowrap ${
                              row[column] === null || row[column] === undefined
                                ? "text-muted-foreground/60 italic"
                                : ""
                            }`}
                          >
                            {previewValue(row[column])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : result ? (
                <p className="text-muted-foreground p-3 text-xs">
                  {result.rowCount} 行（无结果行）
                </p>
              ) : (
                <p className="text-muted-foreground p-3 text-xs">
                  执行一条查询，或点击左侧表名快速预览。
                </p>
              )}
            </div>
            {result && result.rows.length > 0 && (
              <div className="bg-muted/40 text-muted-foreground flex items-center justify-between border-t px-2 py-1 text-xs">
                <span className="tabular-nums">
                  共 {formatCount(totalResultRows)} 行
                </span>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1">
                    每页
                    <select
                      value={resultPageSize === 0 ? "all" : resultPageSize}
                      onChange={(event) => {
                        const value = event.target.value;
                        setResultPageSize(value === "all" ? 0 : Number(value));
                        setResultPage(1);
                      }}
                      className="bg-background h-6 rounded border px-1 text-xs"
                    >
                      <option value={30}>30</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value="all">全部</option>
                    </select>
                  </label>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setResultPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                        className="hover:text-foreground inline-flex items-center disabled:opacity-40"
                        title="上一页"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <span className="tabular-nums">
                        第 {currentPage}/{totalPages} 页
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setResultPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={currentPage >= totalPages}
                        className="hover:text-foreground inline-flex items-center disabled:opacity-40"
                        title="下一页"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Drawer: saved SQL（向内滑入；按钮/Esc/点外部/收起按钮均可复原） */}
        <div
          ref={drawerWrapRef}
          className={`absolute inset-0 z-20 overflow-hidden ${
            savedOpen ? "" : "pointer-events-none"
          }`}
        >
          <button
            type="button"
            aria-label="收起保存的 SQL"
            onClick={() => setSavedOpen(false)}
            className={`absolute inset-0 bg-black/10 transition-opacity duration-200 ${
              savedOpen ? "opacity-100" : "opacity-0"
            }`}
          />
          <aside
            className={`absolute inset-y-0 right-0 flex w-80 max-w-[85vw] flex-col overflow-hidden rounded-l-md border bg-background shadow-xl transition-transform duration-200 ${
              savedOpen ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <div className="bg-muted/40 text-muted-foreground flex items-center justify-between border-b px-2 py-1.5 text-xs font-medium">
              <span>保存的 SQL（{savedQueries.length}）</span>
              <button
                type="button"
                onClick={() => setSavedOpen(false)}
                className="hover:text-foreground inline-flex items-center gap-1"
                title="收起"
              >
                <PanelRightClose className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-1">
              {savedQueries.map((saved) => (
                <div
                  key={saved.id}
                  className={`group rounded px-2 py-1.5 hover:bg-accent ${
                    activeSavedId === saved.id ? "bg-accent" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => loadSaved(saved)}
                      className="min-w-0 flex-1 text-left"
                      title={saved.description ?? saved.name}
                    >
                      <span className="block truncate text-xs font-medium">
                        {saved.name}
                      </span>
                      <span className="text-muted-foreground block font-mono text-[10px] whitespace-pre-wrap break-words">
                        {saved.sql}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSaved(saved.id)}
                      className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                      title="删除"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {savedQueries.length === 0 && (
                <p className="text-muted-foreground p-2 text-xs">
                  暂无保存的 SQL。
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
