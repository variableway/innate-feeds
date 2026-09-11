"use client"

import { useEffect, useState } from "react"
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs"
import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"

const parsers = {
  q: parseAsString.withDefault(""),
  page: parseAsInteger.withDefault(1),
}

export function PluginSearch() {
  const [{ q }, setParams] = useQueryStates(parsers, { shallow: false })
  const [value, setValue] = useState(q)

  // Keep the local input in sync when the URL changes elsewhere (e.g. clear filters)
  useEffect(() => {
    setValue(q)
  }, [q])

  useEffect(() => {
    const id = setTimeout(() => {
      if (value !== q) setParams({ q: value || null, page: null })
    }, 300)
    return () => clearTimeout(id)
  }, [value, q, setParams])

  return (
    <div className="relative w-full sm:max-w-xs">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search plugins…"
        className="pl-8"
        aria-label="Search plugins"
      />
    </div>
  )
}
