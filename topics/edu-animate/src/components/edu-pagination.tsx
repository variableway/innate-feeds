/** 列表分页控件。 */
export function EduPagination({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <div className="mt-8 flex items-center justify-center gap-3 text-sm">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="rounded-md border px-3 py-1 transition-colors hover:bg-accent disabled:opacity-40 disabled:hover:bg-transparent"
      >
        上一页
      </button>
      <span className="text-muted-foreground">
        第 {page} / {pageCount} 页
      </span>
      <button
        type="button"
        disabled={page >= pageCount}
        onClick={() => onChange(page + 1)}
        className="rounded-md border px-3 py-1 transition-colors hover:bg-accent disabled:opacity-40 disabled:hover:bg-transparent"
      >
        下一页
      </button>
    </div>
  );
}
