import { useState } from 'react';
import { Github, RefreshCw, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import DataTable from '@/components/DataTable';
import LanguageBadge from '@/components/LanguageBadge';
import { useI18n } from '@/hooks/useI18n';
import type { Column } from '@/components/DataTable';
import type { GitHubTrending } from '@/types';
import { useTrending, useLanguages, useFetchTrending } from '@/hooks/useTrending';

export default function GitHubTrending() {
  const [period, setPeriod] = useState<string>('daily');
  const [language, setLanguage] = useState<string>('');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string>('stars');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const { t } = useI18n();

  const { data, isLoading } = useTrending({ period, language: language || undefined });
  const { data: languages } = useLanguages();
  const fetchMutation = useFetchTrending();

  const handleSort = (key: string, dir: 'asc' | 'desc') => {
    setSortKey(key);
    setSortDir(dir);
  };

  const handleRefresh = () => {
    fetchMutation.mutate({ period, language: language || undefined });
  };

  const sortedData = [...(data?.data ?? [])].sort((a, b) => {
    const aVal = a[sortKey as keyof GitHubTrending];
    const bVal = b[sortKey as keyof GitHubTrending];
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    }
    return sortDir === 'asc'
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });

  const filteredData = sortedData.filter((r) =>
    !search ||
    r.full_name.toLowerCase().includes(search.toLowerCase()) ||
    r.description.toLowerCase().includes(search.toLowerCase())
  );

  const columns: Column<GitHubTrending>[] = [
    {
      key: 'repository',
      header: t('columnRepository'),
      sortable: false,
      className: 'min-w-[280px]',
      render: (row) => (
        <div>
          <a
            href={row.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold hover:text-primary hover:underline transition-colors"
          >
            {row.full_name}
          </a>
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{row.description}</p>
        </div>
      ),
    },
    {
      key: 'language',
      header: t('columnLanguage'),
      sortable: true,
      render: (row) => <LanguageBadge language={row.language} />,
    },
    {
      key: 'stars',
      header: t('columnStars'),
      sortable: true,
      render: (row) => (
        <span className="text-sm tabular-nums">{row.stars.toLocaleString()}</span>
      ),
    },
    {
      key: 'stars_today',
      header: t('columnStarsToday'),
      sortable: true,
      render: (row) => (
        <span className="text-sm font-medium text-emerald-500 tabular-nums">
          +{row.stars_today.toLocaleString()}
        </span>
      ),
    },
    {
      key: 'forks',
      header: t('columnForks'),
      sortable: true,
      render: (row) => (
        <span className="text-sm tabular-nums">{row.forks.toLocaleString()}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Github className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('trendingTitle')}</h1>
            <p className="text-sm text-muted-foreground">{t('trendingSubtitle')}</p>
          </div>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex flex-col sm:flex-row gap-3"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={t('periodDaily')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">{t('periodDaily')}</SelectItem>
            <SelectItem value="weekly">{t('periodWeekly')}</SelectItem>
            <SelectItem value="monthly">{t('periodMonthly')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t('allLanguages')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t('allLanguages')}</SelectItem>
            {languages?.map((lang) => (
              <SelectItem key={lang} value={lang}>{lang}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          onClick={handleRefresh}
          disabled={fetchMutation.isPending}
        >
          <RefreshCw className={fetchMutation.isPending ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </Button>
      </motion.div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filteredData}
          keyExtractor={(row) => row.id}
          pageSize={8}
          onSort={handleSort}
          sortKey={sortKey}
          sortDirection={sortDir}
        />
      )}
    </div>
  );
}
