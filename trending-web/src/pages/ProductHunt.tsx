import { useState } from 'react';
import { ShoppingBag, Search, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
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
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import ProductCard from '@/components/ProductCard';
import { useI18n } from '@/hooks/useI18n';
import type { ProductHunt } from '@/types';
import { useProductHunt, useCategories, useFetchProductHunt } from '@/hooks/useProductHunt';

export default function ProductHunt() {
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('votes');
  const { t } = useI18n();

  const dayStr = date ? format(date, 'yyyy-MM-dd') : undefined;
  const { data, isLoading } = useProductHunt({ day: dayStr });
  const { data: categories } = useCategories();
  const fetchMutation = useFetchProductHunt();

  const handleRefresh = () => {
    fetchMutation.mutate({ day: dayStr });
  };

  const sortedData = [...(data?.data ?? [])].sort((a, b) => {
    if (sort === 'votes') return b.votes_count - a.votes_count;
    if (sort === 'comments') return b.comments_count - a.comments_count;
    return 0;
  });

  const filteredData = sortedData.filter(
    (p) =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.tagline.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <ShoppingBag className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('phTitle')}</h1>
            <p className="text-sm text-muted-foreground">{t('phSubtitle')}</p>
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
            placeholder={t('searchProductPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[160px]">
              {date ? format(date, 'yyyy-MM-dd') : t('pickDate')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={t('sortVotes')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="votes">{t('sortVotes')}</SelectItem>
            <SelectItem value="comments">{t('sortComments')}</SelectItem>
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

      {/* Products Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 w-full" />
          ))}
        </div>
      ) : filteredData.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredData.map((product, i) => (
            <ProductCard key={product.id} product={product} index={i} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted-foreground">{t('noProductsFound')}</p>
        </div>
      )}
    </div>
  );
}
