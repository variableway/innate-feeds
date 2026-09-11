"use client"

import { parseAsInteger, parseAsString, useQueryStates } from "nuqs"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const parsers = {
  sort: parseAsString.withDefault("stars.desc"),
  page: parseAsInteger.withDefault(1),
}

const SORT_OPTIONS = [
  { value: "stars.desc", label: "Most stars" },
  { value: "stars.asc", label: "Fewest stars" },
  { value: "added.desc", label: "Recently added" },
  { value: "added.asc", label: "Oldest added" },
  { value: "name.asc", label: "Name A–Z" },
  { value: "name.desc", label: "Name Z–A" },
] as const

export function PluginSort() {
  const [{ sort }, setParams] = useQueryStates(parsers, { shallow: false })

  return (
    <Select value={sort} onValueChange={(value) => setParams({ sort: value as string, page: null })}>
      <SelectTrigger aria-label="Sort plugins" className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
