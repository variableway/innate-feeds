import { PAGE_SIZE_OPTIONS } from "@/hooks/use-page-size";

interface PageSizeSelectProps {
  value: number;
  onChange: (pageSize: number) => void;
}

export function PageSizeSelect({ value, onChange }: PageSizeSelectProps) {
  return (
    <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <span>Per page</span>
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="rounded-md border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {PAGE_SIZE_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
