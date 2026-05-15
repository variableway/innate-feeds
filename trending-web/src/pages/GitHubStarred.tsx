import { useState, useEffect } from 'react';
import { Star, User, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import RepoCard from '@/components/RepoCard';
import DataTable from '@/components/DataTable';
import LanguageBadge from '@/components/LanguageBadge';
import { loadSettings } from '@/pages/Settings';
import { useI18n } from '@/hooks/useI18n';
import type { Column } from '@/components/DataTable';
import type { GitHubStarred } from '@/types';
import { useStarred, useFetchStarred, useUserLanguages } from '@/hooks/useStarred';

const BAR_COLORS = ['#00ADD8', '#DEA584', '#3178C6', '#3572A5', '#555555', '#F1E05A', '#F34B7D', '#701516'];

export default function GitHubStarred() {
  const [username, setUsername] = useState('');
  const [submittedUsername, setSubmittedUsername] = useState('');
  const [language, setLanguage] = useState('');
  const [sort, setSort] = useState('starred_at');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const { t } = useI18n();

  useEffect(() => {
    const settings = loadSettings();
    if (settings.defaultUsername) {
      setUsername(settings.defaultUsername);
      setSubmittedUsername(settings.defaultUsername);
    }
  }, []);

  const { data, isLoading } = useStarred({
    username: submittedUsername,
    language: language || undefined,
    sort,
  });
  const { data: languageData } = useUserLanguages(submittedUsername);
  const fetchMutation = useFetchStarred();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedUsername(username.trim());
  };

  const handleFetch = () => {
    if (submittedUsername) {
      fetchMutation.mutate({ username: submittedUsername });
    }
  };

  const chartData = languageData
    ? Object.entries(languageData).map(([name, value]) => ({ name, value }))
    : [];

  const columns: Column<GitHubStarred>[] = [
    {
      key: 'repository',
      header: t('columnRepository'),
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
      render: (row) => <LanguageBadge language={row.language} />,
    },
    {
      key: 'stars',
      header: t('columnStars'),
      sortable: true,
      render: (row) => <span className="text-sm tabular-nums">{row.stars.toLocaleString()}</span>,
    },
    {
      key: 'forks',
      header: t('columnForks'),
      sortable: true,
      render: (row) => <span className="text-sm tabular-nums">{row.forks.toLocaleString()}</span>,
    },
    {
      key: 'starred_at',
      header: t('columnStarred'),
      sortable: true,
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {new Date(row.starred_at).toLocaleDateString()}
        </span>
      ),
    },
  ];

  const languages = [...new Set((data?.data ?? []).map((r) => r.language).filter(Boolean))];

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Star className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('starredTitle')}</h1>
            <p className="text-sm text-muted-foreground">{t('starredSubtitle')}</p>
          </div>
        </div>
      </motion.div>

      {/* Username input */}
      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        onSubmit={handleSubmit}
        className="flex flex-col sm:flex-row gap-3"
      >
        <div className="relative flex-1">
          <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('usernamePlaceholder')}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={!username.trim()}>
          {t('loadRepos')}
        </Button>
        <Button type="button" variant="outline" onClick={handleFetch} disabled={!submittedUsername || fetchMutation.isPending}>
          {fetchMutation.isPending ? t('fetching') : t('fetchFromAPI')}
        </Button>
      </motion.form>

      {submittedUsername ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={viewMode === 'cards' ? 'default' : 'outline'}
                onClick={() => setViewMode('cards')}
              >
                {t('viewCards')}
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'table' ? 'default' : 'outline'}
                onClick={() => setViewMode('table')}
              >
                {t('viewTable')}
              </Button>
            </div>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={t('allLanguagesFilter')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{t('allLanguagesFilter')}</SelectItem>
                {languages.map((lang) => (
                  <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={t('sortRecentlyStarred')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="starred_at">{t('sortRecentlyStarred')}</SelectItem>
                <SelectItem value="stars">{t('sortMostStars')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Language Chart */}
          {chartData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  {t('languageBreakdown')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData}>
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {chartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : viewMode === 'cards' ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data?.data?.map((repo, i) => (
                <RepoCard key={repo.id} repo={repo} index={i} />
              ))}
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={data?.data ?? []}
              keyExtractor={(row) => row.id}
              pageSize={8}
            />
          )}
        </motion.div>
      ) : (
        /* Empty state when no username submitted */
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
            <User className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-1">{t('noUsernameTitle')}</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            {t('noUsernameDesc')}
          </p>
        </motion.div>
      )}
    </div>
  );
}
