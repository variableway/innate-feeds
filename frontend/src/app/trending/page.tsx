'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Star, GitFork, ExternalLink, RefreshCw, TrendingUp, Calendar } from 'lucide-react'
import { api, TrendingRepo } from '@/lib/api'

export default function TrendingPage() {
  const [period, setPeriod] = useState('daily')
  const [snapshotDate, setSnapshotDate] = useState<string>('')
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [repos, setRepos] = useState<TrendingRepo[]>([])
  const [languages, setLanguages] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [collecting, setCollecting] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState<string>('')
  const [currentPage, setCurrentPage] = useState(1)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadDates()
  }, [period])

  useEffect(() => {
    if (snapshotDate) {
      searchRepos()
    }
  }, [period, snapshotDate])

  const loadDates = async () => {
    try {
      const result = await api.getTrendingDates(period)
      const dates = result.dates || []
      setAvailableDates(dates)
      if (dates.length > 0 && !snapshotDate) {
        setSnapshotDate(dates[0])
      }
    } catch (error) {
      console.error('Failed to load dates:', error)
    }
  }

  const searchRepos = async (page = 1) => {
    setLoading(true)
    try {
      const params: any = { period, snapshot_date: snapshotDate, page, perPage: 50 }
      if (selectedLanguage && selectedLanguage !== 'all') params.language = selectedLanguage

      const result = await api.searchTrendingRepos(params)
      setRepos(result.items)
      setCurrentPage(page)

      const langsResult = await api.getTrendingLanguages(period, snapshotDate)
      setLanguages(langsResult.languages || {})
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
      const result = await api.collectTrendingRepos(period)
      setMessage(`Successfully collected ${result.saved} repositories`)
      await loadDates()
      setSnapshotDate(result.snapshot_date)
    } catch (error) {
      console.error('Failed to collect repos:', error)
      setMessage('Failed to collect repositories')
    } finally {
      setCollecting(false)
    }
  }

  useEffect(() => {
    if (snapshotDate) {
      searchRepos(1)
    }
  }, [selectedLanguage])

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold mb-2 flex items-center gap-2">
              <TrendingUp className="h-8 w-8" />
              GitHub Trending Repositories
            </h1>
            <p className="text-muted-foreground">View trending repositories by date and period</p>
          </div>
          <Link href="/">
            <Button variant="outline" className="flex items-center gap-2">
              <Star className="h-4 w-4" />
              View Starred
            </Button>
          </Link>
        </div>

        <div className="bg-card rounded-lg border p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Period</label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Snapshot Date
              </label>
              <Select value={snapshotDate} onValueChange={setSnapshotDate}>
                <SelectTrigger>
                  <SelectValue placeholder="Select date" />
                </SelectTrigger>
                <SelectContent>
                  {availableDates.map((date) => (
                    <SelectItem key={date} value={date}>
                      {date}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

            <div className="flex items-end">
              <Button onClick={collectRepos} disabled={collecting} className="w-full">
                <RefreshCw className={`mr-2 h-4 w-4 ${collecting ? 'animate-spin' : ''}`} />
                {collecting ? 'Collecting...' : 'Collect Trending'}
              </Button>
            </div>
          </div>

          {message && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded text-blue-800 text-sm">
              {message}
            </div>
          )}
        </div>

        <div className="mb-4 text-sm text-muted-foreground">
          Showing {repos.length} repositories for {period} trending on {snapshotDate || 'N/A'}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <p className="mt-2">Loading trending repositories...</p>
          </div>
        ) : repos.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-lg border">
            <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No trending repositories found</p>
            <p className="text-sm text-muted-foreground mt-2">
              Click "Collect Trending" to fetch the latest trending repositories
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {repos.map((repo) => (
              <div key={repo.id} className="bg-card rounded-lg border p-4 hover:shadow-lg transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-muted-foreground">#{repo.rank}</span>
                    <h3 className="font-semibold text-lg truncate flex-1">{repo.repo_name}</h3>
                  </div>
                  <a
                    href={repo.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
                
                <p className="text-xs text-muted-foreground mb-2">{repo.full_name}</p>
                
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
                  {repo.stars_today > 0 && (
                    <div className="flex items-center gap-1 text-green-600">
                      <TrendingUp className="h-4 w-4" />
                      <span>{repo.stars_today.toLocaleString()} stars</span>
                    </div>
                  )}
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
      </div>
    </main>
  )
}
