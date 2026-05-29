"use client";

import { Badge } from "@/components/ui/badge";
import { categories, type CategoryId } from "@/data/skills";
import {
  Code,
  Briefcase,
  MessageSquare,
  BarChart3,
  Settings,
  LayoutGrid,
} from "lucide-react";

const iconMap: Record<string, React.ReactNode> = {
  grid: <LayoutGrid className="h-4 w-4" />,
  code: <Code className="h-4 w-4" />,
  briefcase: <Briefcase className="h-4 w-4" />,
  "message-square": <MessageSquare className="h-4 w-4" />,
  "bar-chart": <BarChart3 className="h-4 w-4" />,
  settings: <Settings className="h-4 w-4" />,
};

interface CategoryFilterProps {
  selected: CategoryId;
  onSelect: (category: CategoryId) => void;
  counts: Record<string, number>;
}

export function CategoryFilter({
  selected,
  onSelect,
  counts,
}: CategoryFilterProps) {
  return (
    <div
      id="categories"
      className="flex flex-wrap items-center gap-2"
    >
      {categories.map((cat) => {
        const isActive = selected === cat.id;
        const count = counts[cat.id] ?? 0;

        return (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
              isActive
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
          >
            {iconMap[cat.icon]}
            <span>{cat.name}</span>
            <Badge
              variant={isActive ? "secondary" : "outline"}
              className={`ml-0.5 text-[10px] ${
                isActive
                  ? "bg-primary-foreground/20 text-primary-foreground border-transparent"
                  : ""
              }`}
            >
              {count}
            </Badge>
          </button>
        );
      })}
    </div>
  );
}
