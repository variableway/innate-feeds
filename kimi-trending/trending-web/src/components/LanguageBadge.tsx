import { cn } from '@/lib/utils';

const LANGUAGE_COLORS: Record<string, string> = {
  Go: 'bg-[#00ADD8]',
  Rust: 'bg-[#DEA584]',
  TypeScript: 'bg-[#3178C6]',
  Python: 'bg-[#3572A5]',
  C: 'bg-[#555555]',
  JavaScript: 'bg-[#F1E05A]',
  'C++': 'bg-[#F34B7D]',
  Ruby: 'bg-[#701516]',
  Java: 'bg-[#B07219]',
  'C#': 'bg-[#178600]',
  Swift: 'bg-[#FFAC45]',
  Kotlin: 'bg-[#A97BFF]',
  PHP: 'bg-[#4F5D95]',
  HTML: 'bg-[#E34C26]',
  CSS: 'bg-[#563D7C]',
  Shell: 'bg-[#89E051]',
  Vue: 'bg-[#41B883]',
};

interface LanguageBadgeProps {
  language: string;
  className?: string;
}

export default function LanguageBadge({ language, className }: LanguageBadgeProps) {
  if (!language) return null;
  const colorClass = LANGUAGE_COLORS[language] || 'bg-muted-foreground';

  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground', className)}>
      <span className={cn('h-2 w-2 rounded-full', colorClass)} />
      {language}
    </span>
  );
}
