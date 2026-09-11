"use client"

import { useQueryStates, parseAsArrayOf, parseAsInteger, parseAsString } from "nuqs"

import { Button } from "@/components/ui/button"

const parsers = {
  q: parseAsString.withDefault(""),
  category: parseAsArrayOf(parseAsString).withDefault([]),
  sort: parseAsString.withDefault("stars.desc"),
  page: parseAsInteger.withDefault(1),
}

export function ClearFiltersButton({ keepCategory }: { keepCategory?: string[] }) {
  const [, setParams] = useQueryStates(parsers, { shallow: false })

  return (
    <Button
      variant="outline"
      onClick={() =>
        setParams({
          q: null,
          category: keepCategory && keepCategory.length > 0 ? keepCategory : null,
          sort: null,
          page: null,
        })
      }
    >
      Clear filters
    </Button>
  )
}
