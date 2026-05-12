'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Star, GitFork, ExternalLink, Search, RefreshCw, TrendingUp, WifiOff, Settings2 } from 'lucide-react'
import { api, StarredRepo, BackendStatus } from '@/lib/api'
import { openExternalUrl } from '@/lib/tauri'

export default function Home() {
  const [username, setUsername] = useState('qdriven')
  const [repos, setRepos] = useState<StarredRepo[]>([])
  const [languages, setLanguages] = useState<Record<string, number>>({})
  const [tags, setTags] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [collecting, setCollecting] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState<string>('')
  const [selectedTag, setSelectedTag] = useState<string>('')
  const [minStars, setMinStars] = useState<string>('')
  const [maxStars, setMaxStars] = useState<string>('')
  const [currentPage, setCurrentPage] = useState(1)
  const [message, setMessage] = useState('')
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [apiUrlInput, setApiUrlInput] = useState('')

  useEffect(() => {
    checkBackend()
  }, [])

  const checkBackend = async () => {
    const status = await api.checkBackend()
    setBackendStatus(status)
    setApiUrlInput(status.url)
    if (status.available && username) {
      loadFilters()
      searchRepos()
    }
  }

  const handleSetApiUrl = () => {
    api.setApiUrl(apiUrlInput)
    checkBackend()
    setShowSettings(false)
  }

  useEffect(() => {
    if (backendStatus?.available && username) {
      loadFilters()
      searchRepos()
    }
  }, [username])

  const loadFilters = async () => {
    try {
      const [langsData, tagsData] = await Promise.all([
        api.getLanguages(username),
        api.getTags(username)
      ])
      setLanguages(langsData.languages)
      setTags(tagsData.tags)
    } catch (error) {
      console.error('Failed to load filters:', error)
    }
  }

  const searchRepos = async (page = 1) => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { github_user: username, page, perPage: 30 }
      if (minStars) params.min_stars = parseInt(minStars)
      if (maxStars) params.max_stars = parseInt(maxStars)
      if (selectedLanguage && selectedLanguage !== 'all') params.language = selectedLanguage
      if (selectedTag && selectedTag !== 'all') params.tag = selectedTag

      const result = await api.searchStarredRepos(params as any)
      setRepos(result.items)
      setCurrentPage(page)
      setMessage('')
    } catch (error: any) {
      const msg = error?.message || 'Failed to search repositories. Make sure the backend is running.'
      setMessage(msg)
    } finally {
      setLoading(false)
    }
  }

  const collectRepos = async () => {
    setCollecting(true)
    setMessage('')
    try {
      const result = await api.collectStarredRepos(username)
      setMessage(`Collected ${result.fetched} repos: ${result.saved} new, ${result.updated} updated`)
      await loadFilters()
      await searchRepos()
    } catch (error: any) {
      const msg = error?.message || 'Failed to collect repositories. Check backend connection.'
      setMessage(msg)
    } finally {
      setCollecting(false)
    }
  }

  const handleSearch = () => {
    searchRepos(1)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold mb-2">GitHub Starred Repositories</h1>
            <p className="text-muted-foreground">View and filter starred repositories for any GitHub user</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/trending">
              <Button variant="outline" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                View Trending
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
              title="Backend settings"
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {backendStatus && !backendStatus.available && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <WifiOff className="h-5 w-5 text-red-600" />
            <div className="flex-1">
              <p className="font-medium text-red-800">Backend not connected</p>
              <p className="text-sm text-red-600">
                Start the backend at <code className="bg-red-100 px-1 rounded">{backendStatus.url}</code> or change the URL in settings.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={checkBackend}>
              Retry
            </Button>
          </div>
        )}

        {showSettings && (
          <div className="mb-6 p-4 bg-card rounded-lg border">
            <p className="text-sm font-medium mb-2">Backend URL</p>
            <div className="flex gap-2">
              <Input
                value={apiUrlInput}
                onChange={(e) => setApiUrlInput(e.target.value)}
                placeholder="http://localhost:8090"
                className="max-w-sm"
              />
              <Button onClick={handleSetApiUrl} size="sm">Save</Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Current: {api.getApiUrl()}
            </p>
          </div>
        )}

        <div className="bg-card rounded-lg border p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4">
            <div className="md:col-span-2">
              <label className="text-sm font-medium mb-2 block">GitHub Username</label>
              <Input
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Min Stars</label>
              <Input
                type="number"
                placeholder="0"
                value={minStars}
                onChange={(e) => setMinStars(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Max Stars</label>
              <Input
                type="number"
                placeholder="Any"
                value={maxStars}
                onChange={(e) => setMaxStars(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Language</label>
              <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                <SelectTrigger>
                  <SelectValue placeholder="All languages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All languages</SelectItem>
                  {Object.keys(languages).sort().map((lang) => (
                    <SelectItem key={lang} value={lang}>
                      {lang} ({languages[lang]})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Tag</label>
              <Select value={selectedTag} onValueChange={setSelectedTag}>
                <SelectTrigger>
                  <SelectValue placeholder="All tags" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tags</SelectItem>
                  {Object.keys(tags).sort().slice(0, 50).map((tag) => (
                    <SelectItem key={tag} value={tag}>
                      {tag} ({tags[tag]})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSearch} disabled={loading || !backendStatus?.available}>
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
            <Button onClick={collectRepos} disabled={collecting || !backendStatus?.available} variant="outline">
              <RefreshCw className={`mr-2 h-4 w-4 ${collecting ? 'animate-spin' : ''}`} />
              {collecting ? 'Collecting...' : 'Collect Repos'}
            </Button>
          </div>

          {message && (
            <div className={`mt-4 p-3 rounded text-sm ${
              message.startsWith('Collected')
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-blue-50 border border-blue-200 text-blue-800'
            }`}>
              {message}
            </div>
          )}
        </div>

        <div className="mb-4 text-sm text-muted-foreground">
          Found {repos.length} repositories
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <p className="mt-2">Loading repositories...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {repos.map((repo) => (
              <div key={repo.id} className="bg-card rounded-lg border p-4 hover:shadow-lg transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-lg truncate flex-1">{repo.repo_name}</h3>
                  <button
                    onClick={() => openExternalUrl(repo.html_url)}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </button>
                </div>

                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {repo.description || 'No description available'}
                </p>

                <div className="flex items-center gap-4 text-sm mb-2">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-yellow-500" />
                    <span>{repo.star_num.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <GitFork className="h-4 w-4 text-gray-500" />
                    <span>{repo.fork_num.toLocaleString()}</span>
                  </div>
                </div>

                {repo.language && (
                  <div className="mb-2">
                    <span className="inline-block px-2 py-1 text-xs rounded bg-blue-100 text-blue-800">
                      {repo.language}
                    </span>
                  </div>
                )}

                {repo.tags && (
                  <div className="flex flex-wrap gap-1">
                    {repo.tags.split(',').slice(0, 3).map((tag, i) => (
                      <span
                        key={i}
                        className="inline-block px-2 py-1 text-xs rounded bg-gray-100 text-gray-700"
                      >
                        {tag.trim()}
                      </span>
                    ))}
                    {repo.tags.split(',').length > 3 && (
                      <span className="text-xs text-muted-foreground">
                        +{repo.tags.split(',').length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && repos.length > 0 && (
          <div className="flex justify-center mt-8 gap-2">
            <Button
              onClick={() => searchRepos(currentPage - 1)}
              disabled={currentPage === 1}
              variant="outline"
            >
              Previous
            </Button>
            <span className="px-4 py-2">Page {currentPage}</span>
            <Button
              onClick={() => searchRepos(currentPage + 1)}
              disabled={repos.length < 30}
              variant="outline"
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </main>
  )
}
