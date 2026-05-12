import axios from 'axios'

const DEFAULT_API_URL = 'http://localhost:8090'

function getApiUrl(): string {
  if (typeof window === 'undefined') return DEFAULT_API_URL
  return localStorage.getItem('api_url') || process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL
}

function setApiUrl(url: string) {
  localStorage.setItem('api_url', url)
}

export interface StarredRepo {
  id: string
  github_user: string
  repo_id: number
  repo_name: string
  full_name: string
  description: string
  html_url: string
  star_num: number
  language: string
  fork_num: number
  tags: string
  created_at: string
  updated_at: string
  pushed_at: string
  collected_at: string
}

export interface SearchParams {
  github_user: string
  min_stars?: number
  max_stars?: number
  language?: string
  tag?: string
  page?: number
  perPage?: number
}

export interface SearchResult {
  page: number
  perPage: number
  items: StarredRepo[]
}

export interface LanguagesResponse {
  languages: Record<string, number>
}

export interface TagsResponse {
  tags: Record<string, number>
}

export interface CollectResult {
  username: string
  fetched: number
  saved: number
  updated: number
  message: string
}

export interface BackendStatus {
  available: boolean
  url: string
}

async function request<T>(method: 'get' | 'post', path: string, data?: unknown): Promise<T> {
  const url = `${getApiUrl()}${path}`
  try {
    const response = method === 'post'
      ? await axios.post(url, data, { timeout: 120000 })
      : await axios.get(url, { timeout: 30000 })
    return response.data
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.message) {
      throw new Error(error.response.data.message)
    }
    throw error
  }
}

export const api = {
  getApiUrl,
  setApiUrl,

  async checkBackend(): Promise<BackendStatus> {
    try {
      await axios.get(`${getApiUrl()}/api/health`, { timeout: 5000 })
      return { available: true, url: getApiUrl() }
    } catch {
      return { available: false, url: getApiUrl() }
    }
  },

  async fetchStarredRepos(username: string) {
    return request<{ username: string; count: number; repos: unknown[] }>('get', `/api/github/starred/${username}`)
  },

  async collectStarredRepos(username: string): Promise<CollectResult> {
    return request<CollectResult>('post', `/api/github/collect/${username}`)
  },

  async searchStarredRepos(params: SearchParams): Promise<SearchResult> {
    const sp = new URLSearchParams()
    sp.append('github_user', params.github_user)
    if (params.min_stars !== undefined) sp.append('min_stars', params.min_stars.toString())
    if (params.max_stars !== undefined) sp.append('max_stars', params.max_stars.toString())
    if (params.language) sp.append('language', params.language)
    if (params.tag) sp.append('tag', params.tag)
    if (params.page) sp.append('page', params.page.toString())
    if (params.perPage) sp.append('perPage', params.perPage.toString())
    return request<SearchResult>('get', `/api/starred/search?${sp.toString()}`)
  },

  async getLanguages(username: string): Promise<LanguagesResponse> {
    return request<LanguagesResponse>('get', `/api/starred/languages/${username}`)
  },

  async getTags(username: string): Promise<TagsResponse> {
    return request<TagsResponse>('get', `/api/starred/tags/${username}`)
  },

  async collectTrendingRepos(period: string = 'daily') {
    return request<{ period: string; fetched: number; saved: number; snapshot_date: string; message: string }>('post', `/api/github/trending/collect?period=${period}`)
  },

  async searchTrendingRepos(params: TrendingSearchParams): Promise<TrendingSearchResult> {
    const sp = new URLSearchParams()
    if (params.period) sp.append('period', params.period)
    if (params.snapshot_date) sp.append('snapshot_date', params.snapshot_date)
    if (params.language) sp.append('language', params.language)
    if (params.min_stars !== undefined) sp.append('min_stars', params.min_stars.toString())
    if (params.max_stars !== undefined) sp.append('max_stars', params.max_stars.toString())
    if (params.page) sp.append('page', params.page.toString())
    if (params.perPage) sp.append('perPage', params.perPage.toString())
    return request<TrendingSearchResult>('get', `/api/trending/search?${sp.toString()}`)
  },

  async getTrendingDates(period: string = 'daily') {
    return request<{ period: string; dates: string[] }>('get', `/api/trending/dates?period=${period}`)
  },

  async getTrendingLanguages(period?: string, snapshotDate?: string) {
    const sp = new URLSearchParams()
    if (period) sp.append('period', period)
    if (snapshotDate) sp.append('snapshot_date', snapshotDate)
    return request<{ languages: Record<string, number> }>('get', `/api/trending/languages?${sp.toString()}`)
  },
}

export interface TrendingRepo {
  id: string
  repo_id: number
  repo_name: string
  full_name: string
  description: string
  html_url: string
  star_num: number
  language: string
  fork_num: number
  tags: string
  trending_period: string
  snapshot_date: string
  stars_today: number
  rank: number
  collected_at: string
}

export interface TrendingSearchParams {
  period?: string
  snapshot_date?: string
  language?: string
  min_stars?: number
  max_stars?: number
  page?: number
  perPage?: number
}

export interface TrendingSearchResult {
  page: number
  perPage: number
  items: TrendingRepo[]
}
