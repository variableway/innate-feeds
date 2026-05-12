'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Star, TrendingUp, Menu, X, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isTauri } from '@/lib/tauri'
import { Button } from '@/components/ui/button'

const navItems = [
  { href: '/', label: 'Starred Repos', icon: Star },
  { href: '/trending', label: 'Trending', icon: TrendingUp },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [desktop, setDesktop] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const pathname = usePathname()

  useEffect(() => {
    setDesktop(isTauri())
  }, [])

  if (!desktop) {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen bg-background">
      <aside
        className={cn(
          'border-r bg-card transition-all duration-200 flex flex-col',
          sidebarOpen ? 'w-56' : 'w-14'
        )}
      >
        <div className="p-4 flex items-center justify-between">
          {sidebarOpen && (
            <h2 className="font-semibold text-sm truncate">Innate Feeds</h2>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  !sidebarOpen && 'justify-center px-2'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
