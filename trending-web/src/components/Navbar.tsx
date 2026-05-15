import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { useI18n } from '@/hooks/useI18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeToggle from '@/components/ThemeToggle';

export default function Navbar() {
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="text-sm font-bold tracking-tight hover:text-primary transition-colors"
        >
          {t('appName')}
        </button>
        <span className="text-xs text-muted-foreground hidden sm:inline">{t('appSubtitle')}</span>
      </div>
      <div className="flex items-center gap-1">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
    </header>
  );
}
