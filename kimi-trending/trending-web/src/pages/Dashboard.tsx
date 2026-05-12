import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Star,
  ShoppingBag,
  ArrowRight,
  Github,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import StatCard from '@/components/StatCard';
import RepoCard from '@/components/RepoCard';
import ProductCard from '@/components/ProductCard';
import { useStats } from '@/hooks/useStats';
import { useTrending } from '@/hooks/useTrending';
import { useProductHunt } from '@/hooks/useProductHunt';
import { useI18n } from '@/hooks/useI18n';

export default function Dashboard() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { data: stats, isLoading: statsLoading } = useStats();
  const { data: trendingData } = useTrending({ period: 'daily', limit: 5 });
  const { data: productHuntData } = useProductHunt({ limit: 5 });

  const formatDate = (dateStr: string) => {
    if (!dateStr) return t('never');
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('dashboardTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('dashboardWelcome')}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.reload()}
          className="gap-2 w-fit"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </motion.div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title={t('statTrendingRepos')}
          value={statsLoading ? '...' : stats?.total_trending ?? 0}
          icon={TrendingUp}
          description={`${t('lastFetch')}: ${formatDate(stats?.last_fetch_trending ?? '')}`}
          delay={0}
        />
        <StatCard
          title={t('statStarredRepos')}
          value={statsLoading ? '...' : stats?.total_starred ?? 0}
          icon={Star}
          description={`${t('lastFetch')}: ${formatDate(stats?.last_fetch_starred ?? '')}`}
          delay={1}
        />
        <StatCard
          title={t('statProductHuntItems')}
          value={statsLoading ? '...' : stats?.total_producthunt ?? 0}
          icon={ShoppingBag}
          description={`${t('lastFetch')}: ${formatDate(stats?.last_fetch_producthunt ?? '')}`}
          delay={2}
        />
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">{t('quickActions')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => navigate('/github-trending')} className="gap-2">
                <Github className="h-3.5 w-3.5" />
                {t('exploreTrending')}
                <ArrowRight className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate('/github-starred')} className="gap-2">
                <Star className="h-3.5 w-3.5" />
                {t('viewStarred')}
                <ArrowRight className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate('/product-hunt')} className="gap-2">
                <ShoppingBag className="h-3.5 w-3.5" />
                {t('browseProducts')}
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <Separator />

      {/* Trending Preview */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('recentTrending')}</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/github-trending')} className="gap-1 text-xs">
            {t('viewAll')} <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {trendingData?.data?.slice(0, 5).map((repo, i) => (
            <RepoCard key={repo.id} repo={repo} index={i} showStarsToday />
          ))}
        </div>
      </div>

      {/* Product Hunt Preview */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('latestProductHunt')}</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/product-hunt')} className="gap-1 text-xs">
            {t('viewAll')} <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {productHuntData?.data?.slice(0, 5).map((product, i) => (
            <ProductCard key={product.id} product={product} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
