'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Star, GitFork, ExternalLink, Search, RefreshCw, TrendingUp } from 'lucide-react'
import { api, StarredRepo, LanguagesResponse, TagsResponse } from '@/lib/api'

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

  useEffect(() => {
    if (username) {
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
      const params: any = { github_user: username, page, perPage: 30 }
      if (minStars) params.min_stars = parseInt(minStars)
      if (maxStars) params.max_stars = parseInt(maxStars)
      if (selectedLanguage && selectedLanguage !== 'all') params.language = selectedLanguage
      if (selectedTag && selectedTag !== 'all') params.tag = selectedTag

      const result = await api.searchStarredRepos(params)
      setRepos(result.items)
      setCurrentPage(page)
    } catch (error) {
      console.error('Failed to search repos:', error)
      setMessage('Failed to search repositories')
    } finally {
      setLoading(false)
    }
  }

  const collectRepos = async () => {
    setCollecting(true)
    setMessage('')
    try {
      const result = await api.collectStarredRepos(username)
      setMessage(`Successfully collected ${result.saved} repositories`)
      await loadFilters()
      await searchRepos()
    } catch (error) {
      console.error('Failed to collect repos:', error)
      setMessage('Failed to collect repositories')
    } finally {
      setCollecting(false)
    }
  }

  const handleSearch = () => {
    searchRepos(1)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
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
          <Link href="/trending">
            <Button variant="outline" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              View Trending
            </Button>
          </Link>
        </div>

        <div className="bg-card rounded-lg border p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4">
            <div className="md:col-span-2">
              <label className="text-sm font-medium mb-2 block">GitHub Username</label>
              <Input
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyPress={handleKeyPress}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Min Stars</label>
              <Input
                type="number"
                placeholder="0"
                value={minStars}
                onChange={(e) => setMinStars(e.target.value)}
                onKeyPress={handleKeyPress}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Max Stars</label>
              <Input
                type="number"
                placeholder="Any"
                value={maxStars}
                onChange={(e) => setMaxStars(e.target.value)}
                onKeyPress={handleKeyPress}
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
            <Button onClick={handleSearch} disabled={loading}>
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
            <Button onClick={collectRepos} disabled={collecting} variant="outline">
              <RefreshCw className={`mr-2 h-4 w-4 ${collecting ? 'animate-spin' : ''}`} />
              {collecting ? 'Collecting...' : 'Collect Repos'}
            </Button>
          </div>

          {message && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-blue-800 text-sm">
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
                  <a
                    href={repo.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-blue-600 hover:text-blue-800"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
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
