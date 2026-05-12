import { useI18n, type Language } from '@/hooks/useI18n';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe } from 'lucide-react';

export default function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 px-2">
          <Globe className="h-4 w-4" />
          <span className="text-xs font-medium">{lang === 'zh' ? '中文' : 'EN'}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setLang('en')} className={lang === 'en' ? 'bg-accent' : ''}>
          {t('langEnglish')} 🇺🇸
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLang('zh')} className={lang === 'zh' ? 'bg-accent' : ''}>
          {t('langChinese')} 🇨🇳
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
