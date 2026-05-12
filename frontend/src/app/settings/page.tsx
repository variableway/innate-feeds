'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Settings2, Star, TrendingUp, RefreshCw, Play, WifiOff, Wifi } from 'lucide-react'
import { api, BackendStatus } from '@/lib/api'

interface JobResult {
  type: string
  status: 'success' | 'error'
  message: string
  timestamp: string
}

export default function SettingsPage() {
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null)
  const [apiUrlInput, setApiUrlInput] = useState('')
  const [jobs, setJobs] = useState<JobResult[]>([])

  // Starred repos collection
  const [starredUsername, setStarredUsername] = useState('qdriven')
  const [collectingStarred, setCollectingStarred] = useState(false)

  // Trending repos collection
  const [trendingPeriod, setTrendingPeriod] = useState('daily')
  const [collectingTrending, setCollectingTrending] = useState(false)

  useEffect(() => {
    checkBackend()
  }, [])

  const checkBackend = async () => {
    const status = await api.checkBackend()
    setBackendStatus(status)
    setApiUrlInput(status.url)
  }

  const handleSetApiUrl = () => {
    api.setApiUrl(apiUrlInput)
    checkBackend()
  }

  const addJob = (job: JobResult) => {
    setJobs(prev => [job, ...prev])
  }

  const runCollectStarred = async () => {
    if (!starredUsername.trim()) return
    setCollectingStarred(true)
    try {
      const result = await api.collectStarredRepos(starredUsername)
      addJob({
        type: `Starred: ${starredUsername}`,
        status: 'success',
        message: `Fetched ${result.fetched}, saved ${result.saved}, updated ${result.updated}`,
        timestamp: new Date().toLocaleTimeString(),
      })
    } catch (error) {
      addJob({
        type: `Starred: ${starredUsername}`,
        status: 'error',
        message: 'Failed to collect. Check backend connection.',
        timestamp: new Date().toLocaleTimeString(),
      })
    } finally {
      setCollectingStarred(false)
    }
  }

  const runCollectTrending = async () => {
    setCollectingTrending(true)
    try {
      const result = await api.collectTrendingRepos(trendingPeriod)
      addJob({
        type: `Trending: ${trendingPeriod}`,
        status: 'success',
        message: `Saved ${result.saved} repos (${result.snapshot_date})`,
        timestamp: new Date().toLocaleTimeString(),
      })
    } catch (error) {
      addJob({
        type: `Trending: ${trendingPeriod}`,
        status: 'error',
        message: 'Failed to collect. Check backend connection.',
        timestamp: new Date().toLocaleTimeString(),
      })
    } finally {
      setCollectingTrending(false)
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold mb-2 flex items-center gap-2">
              <Settings2 className="h-8 w-8" />
              Settings
            </h1>
            <p className="text-muted-foreground">Configure backend and run data collection jobs</p>
          </div>
          <div className="flex gap-2">
            <Link href="/">
              <Button variant="outline" size="sm" className="flex items-center gap-1">
                <Star className="h-4 w-4" />
                Starred
              </Button>
            </Link>
            <Link href="/trending">
              <Button variant="outline" size="sm" className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4" />
                Trending
              </Button>
            </Link>
          </div>
        </div>

        {/* Backend Connection */}
        <section className="bg-card rounded-lg border p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            {backendStatus?.available ? (
              <Wifi className="h-5 w-5 text-green-600" />
            ) : (
              <WifiOff className="h-5 w-5 text-red-600" />
            )}
            Backend Connection
          </h2>

          {backendStatus && !backendStatus.available && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
              Backend not reachable at <code className="bg-red-100 px-1 rounded">{backendStatus.url}</code>.
              Make sure PocketBase is running.
            </div>
          )}

          <div className="flex gap-2 items-end">
            <div className="flex-1 max-w-sm">
              <label className="text-sm font-medium mb-2 block">API URL</label>
              <Input
                value={apiUrlInput}
                onChange={(e) => setApiUrlInput(e.target.value)}
                placeholder="http://localhost:8090"
              />
            </div>
            <Button onClick={handleSetApiUrl}>Save</Button>
            <Button variant="outline" onClick={checkBackend}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </section>

        {/* Data Collection Jobs */}
        <section className="bg-card rounded-lg border p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Data Collection Jobs</h2>

          <div className="space-y-4">
            {/* Collect Starred */}
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Collect Starred Repos</label>
                <Input
                  value={starredUsername}
                  onChange={(e) => setStarredUsername(e.target.value)}
                  placeholder="GitHub username"
                />
              </div>
              <Button
                onClick={runCollectStarred}
                disabled={collectingStarred || !backendStatus?.available}
                className="whitespace-nowrap"
              >
                <Play className="mr-2 h-4 w-4" />
                {collectingStarred ? 'Running...' : 'Run'}
              </Button>
            </div>

            {/* Collect Trending */}
            <div className="flex gap-3 items-end">
              <div className="w-48">
                <label className="text-sm font-medium mb-2 block">Collect Trending</label>
                <Select value={trendingPeriod} onValueChange={setTrendingPeriod}>
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
              <Button
                onClick={runCollectTrending}
                disabled={collectingTrending || !backendStatus?.available}
                className="whitespace-nowrap"
              >
                <Play className="mr-2 h-4 w-4" />
                {collectingTrending ? 'Running...' : 'Run'}
              </Button>
            </div>
          </div>
        </section>

        {/* Job History */}
        {jobs.length > 0 && (
          <section className="bg-card rounded-lg border p-6">
            <h2 className="text-xl font-semibold mb-4">Job History</h2>
            <div className="space-y-2">
              {jobs.map((job, i) => (
                <div
                  key={i}
                  className={`p-3 rounded text-sm border ${
                    job.status === 'success'
                      ? 'bg-green-50 border-green-200 text-green-800'
                      : 'bg-red-50 border-red-200 text-red-800'
                  }`}
                >
                  <div className="flex justify-between">
                    <span className="font-medium">{job.type}</span>
                    <span className="text-xs opacity-75">{job.timestamp}</span>
                  </div>
                  <p>{job.message}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
