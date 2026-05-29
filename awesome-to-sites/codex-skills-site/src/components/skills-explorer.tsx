"use client";

import { useState, useMemo } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CategoryFilter } from "@/components/category-filter";
import { SkillCard } from "@/components/skill-card";
import type { Skill, CategoryId } from "@/data/skills";

const PAGE_SIZE = 12;

interface SkillsExplorerProps {
  skills: Skill[];
  categoryCounts: Record<string, number>;
}

export function SkillsExplorer({ skills, categoryCounts }: SkillsExplorerProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryId>("all");
  const [sortBy, setSortBy] = useState<"name" | "category">("category");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let result = skills;

    if (category !== "all") {
      result = result.filter((s) => s.category === category);
    }

    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.tags.some((t) => t.includes(q))
      );
    }

    if (sortBy === "name") {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  }, [skills, category, query, sortBy]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleCategoryChange = (cat: CategoryId) => {
    setCategory(cat);
    setPage(1);
  };

  const handleSearchChange = (value: string) => {
    setQuery(value);
    setPage(1);
  };

  return (
    <section id="skills" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Search and filter bar */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search skills..."
            className="pl-9"
            value={query}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={sortBy === "category" ? "default" : "outline"}
            size="sm"
            onClick={() => setSortBy("category")}
          >
            Category
          </Button>
          <Button
            variant={sortBy === "name" ? "default" : "outline"}
            size="sm"
            onClick={() => setSortBy("name")}
          >
            A–Z
          </Button>
        </div>
      </div>

      {/* Category filter */}
      <div className="mb-8">
        <CategoryFilter
          selected={category}
          onSelect={handleCategoryChange}
          counts={categoryCounts}
        />
      </div>

      {/* Results info */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing{" "}
          <span className="font-medium text-foreground">{paginated.length}</span>{" "}
          of{" "}
          <span className="font-medium text-foreground">{filtered.length}</span>{" "}
          skills
        </p>
        {totalPages > 1 && (
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
        )}
      </div>

      {/* Skills grid */}
      {paginated.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paginated.map((skill) => (
            <SkillCard key={skill.slug} skill={skill} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <SlidersHorizontal className="mb-3 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm font-medium text-muted-foreground">
            No skills found
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Try adjusting your search or category filter
          </p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Button
              key={p}
              variant={p === page ? "default" : "outline"}
              size="sm"
              className="hidden sm:inline-flex"
              onClick={() => setPage(p)}
            >
              {p}
            </Button>
          ))}
          <span className="text-sm text-muted-foreground sm:hidden">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </Button>
        </div>
      )}
    </section>
  );
}
