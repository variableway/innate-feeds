import { useI18n } from '@/hooks/useI18n';

export default function Footer() {
  const { t } = useI18n();

  return (
    <footer className="border-t py-4 px-4 text-center text-xs text-muted-foreground">
      {t('footerCopyright')}
    </footer>
  );
}
