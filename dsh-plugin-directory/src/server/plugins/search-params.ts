import {
  createSearchParamsCache,
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server"

export const pluginSearchParams = {
  q: parseAsString.withDefault(""),
  category: parseAsArrayOf(parseAsString).withDefault([]),
  // "<field>.<dir>", e.g. "stars.desc" | "added.desc" | "name.asc"
  sort: parseAsString.withDefault("stars.desc"),
  view: parseAsStringLiteral(["grid", "list"]).withDefault("grid"),
  page: parseAsInteger.withDefault(1),
  perPage: parseAsInteger.withDefault(35),
}

export const loadSearchParams = createSearchParamsCache(pluginSearchParams)
