import { motion } from 'framer-motion';
import { Star, GitFork, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import LanguageBadge from './LanguageBadge';
import type { GitHubTrending, GitHubStarred } from '@/types';

interface RepoCardProps {
  repo: GitHubTrending | GitHubStarred;
  index?: number;
  showStarsToday?: boolean;
}

function isTrending(repo: GitHubTrending | GitHubStarred): repo is GitHubTrending {
  return 'stars_today' in repo;
}

export default function RepoCard({ repo, index = 0, showStarsToday = false }: RepoCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
      whileHover={{ y: -2 }}
    >
      <Card className="group h-full overflow-hidden transition-shadow hover:shadow-md">
        <CardContent className="flex h-full flex-col p-5">
          <div className="mb-3 flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-semibold group-hover:text-primary transition-colors">
                {repo.full_name}
              </h3>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="ml-2 h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              asChild
            >
              <a href={repo.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>

          <p className="mb-4 line-clamp-2 flex-1 text-xs text-muted-foreground">{repo.description}</p>

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <LanguageBadge language={repo.language} />
            <span className="inline-flex items-center gap-1">
              <Star className="h-3 w-3" />
              {repo.stars.toLocaleString()}
            </span>
            <span className="inline-flex items-center gap-1">
              <GitFork className="h-3 w-3" />
              {repo.forks.toLocaleString()}
            </span>
            {showStarsToday && isTrending(repo) && repo.stars_today > 0 && (
              <span className="inline-flex items-center gap-1 text-emerald-500 font-medium">
                <Star className="h-3 w-3" />
                +{repo.stars_today} today
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
