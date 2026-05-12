import { motion } from 'framer-motion';
import { ThumbsUp, MessageCircle, ExternalLink, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ProductHunt } from '@/types';

interface ProductCardProps {
  product: ProductHunt;
  index?: number;
}

export default function ProductCard({ product, index = 0 }: ProductCardProps) {
  let topics: string[] = [];
  try {
    topics = JSON.parse(product.topics) as string[];
  } catch {
    topics = product.topics ? product.topics.split(',').map((t) => t.trim()) : [];
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
      whileHover={{ y: -3 }}
    >
      <Card className="group h-full overflow-hidden transition-shadow hover:shadow-lg">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <img
            src={product.thumbnail}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          {product.featured && (
            <div className="absolute left-3 top-3">
              <Badge className="bg-amber-500/90 text-white hover:bg-amber-500 text-[10px]">
                <Sparkles className="mr-1 h-3 w-3" />
                Featured
              </Badge>
            </div>
          )}
        </div>

        <CardContent className="p-5">
          <div className="mb-2 flex items-start justify-between">
            <h3 className="text-sm font-semibold group-hover:text-primary transition-colors line-clamp-1">
              {product.name}
            </h3>
            <Button
              variant="ghost"
              size="icon"
              className="ml-2 h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              asChild
            >
              <a href={product.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>

          <p className="mb-4 line-clamp-2 text-xs text-muted-foreground">{product.tagline}</p>

          <div className="mb-4 flex flex-wrap gap-1">
            {topics.slice(0, 3).map((topic) => (
              <Badge key={topic} variant="outline" className="text-[10px] px-1.5 py-0">
                {topic}
              </Badge>
            ))}
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
              <ThumbsUp className="h-3.5 w-3.5" />
              {product.votes_count.toLocaleString()}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="h-3.5 w-3.5" />
              {product.comments_count.toLocaleString()}
            </span>
            <span className="ml-auto text-[10px]">{product.day}</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
