"use client"

import { parseAsArrayOf, parseAsInteger, parseAsString, useQueryStates } from "nuqs"
import { ChevronDown, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CATEGORIES } from "@/lib/categories"

const parsers = {
  category: parseAsArrayOf(parseAsString).withDefault([]),
  page: parseAsInteger.withDefault(1),
}

export function PluginCategoryFilter() {
  const [{ category }, setParams] = useQueryStates(parsers, { shallow: false })

  const toggle = (id: string, checked: boolean) => {
    const next = checked ? [...category, id] : category.filter((c) => c !== id)
    setParams({ category: next.length > 0 ? next : null, page: null })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" className="justify-between">
            Categories
            {category.length > 0 ? (
              <span className="rounded-full bg-secondary px-1.5 text-xs">{category.length}</span>
            ) : null}
            <ChevronDown className="size-4 text-muted-foreground" />
          </Button>
        }
      />
      <DropdownMenuContent className="max-h-96 w-64 overflow-y-auto" align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center justify-between">
            Categories
            {category.length > 0 ? (
              <button
                type="button"
                className="flex items-center gap-1 text-xs font-normal text-muted-foreground hover:text-foreground"
                onClick={() => setParams({ category: null, page: null })}
              >
                <X className="size-3" /> Clear
              </button>
            ) : null}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {CATEGORIES.map((c) => (
            <DropdownMenuCheckboxItem
              key={c.id}
              checked={category.includes(c.id)}
              onCheckedChange={(checked) => toggle(c.id, checked)}
            >
              <span aria-hidden>{c.emoji}</span>
              {c.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
