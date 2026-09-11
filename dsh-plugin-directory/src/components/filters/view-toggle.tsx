"use client"

import { LayoutGrid, List } from "lucide-react"
import { useQueryState } from "nuqs"

import { Button } from "@/components/ui/button"

export function ViewToggle() {
  const [view, setView] = useQueryState("view", {
    defaultValue: "grid",
    shallow: false,
    clearOnDefault: true,
  })

  return (
    <div className="flex items-center rounded-md border">
      <Button
        variant={view === "grid" ? "secondary" : "ghost"}
        size="icon-sm"
        aria-label="Card view"
        aria-pressed={view === "grid"}
        className="rounded-r-none"
        onClick={() => setView("grid")}
      >
        <LayoutGrid />
      </Button>
      <Button
        variant={view === "list" ? "secondary" : "ghost"}
        size="icon-sm"
        aria-label="List view"
        aria-pressed={view === "list"}
        className="rounded-l-none"
        onClick={() => setView("list")}
      >
        <List />
      </Button>
    </div>
  )
}
