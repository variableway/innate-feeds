import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useI18n } from '@/hooks/useI18n';

const STORAGE_KEY = 'trending-aggregator-settings';

export interface AppSettings {
  apiUrl: string;
  mockMode: boolean;
  theme: 'dark' | 'light' | 'system';
  refreshInterval: number;
  githubToken: string;
  phToken: string;
  defaultUsername: string;
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        apiUrl: parsed.apiUrl || import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1',
        mockMode: parsed.mockMode !== false,
        theme: parsed.theme || 'light',
        refreshInterval: parsed.refreshInterval ?? 30,
        githubToken: parsed.githubToken || '',
        phToken: parsed.phToken || '',
        defaultUsername: parsed.defaultUsername || '',
      };
    }
  } catch {
    // ignore parse errors
  }
  return {
    apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1',
    mockMode: true,
    theme: 'light',
    refreshInterval: 30,
    githubToken: '',
    phToken: '',
    defaultUsername: '',
  };
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export default function Settings() {
  const saved = loadSettings();
  const [apiUrl, setApiUrl] = useState(saved.apiUrl);
  const [mockMode, setMockMode] = useState(saved.mockMode);
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>(saved.theme);
  const [refreshInterval, setRefreshInterval] = useState(saved.refreshInterval);
  const [githubToken, setGithubToken] = useState(saved.githubToken);
  const [phToken, setPhToken] = useState(saved.phToken);
  const [defaultUsername, setDefaultUsername] = useState(saved.defaultUsername);
  const [showGhToken, setShowGhToken] = useState(false);
  const [showPhToken, setShowPhToken] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    if (theme === 'system') {
      const sys = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(sys);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  const handleSave = () => {
    saveSettings({
      apiUrl,
      mockMode,
      theme,
      refreshInterval,
      githubToken,
      phToken,
      defaultUsername,
    });
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <SettingsIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('settingsTitle')}</h1>
            <p className="text-sm text-muted-foreground">{t('settingsSubtitle')}</p>
          </div>
        </div>
      </motion.div>

      {/* General Settings */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('generalTitle')}</CardTitle>
            <CardDescription>{t('generalDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-url">{t('apiUrlLabel')}</Label>
              <Input
                id="api-url"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="http://localhost:8080/api/v1"
              />
              <p className="text-xs text-muted-foreground">{t('apiUrlHint')}</p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('mockModeLabel')}</Label>
                <p className="text-xs text-muted-foreground">{t('mockModeHint')}</p>
              </div>
              <Switch checked={mockMode} onCheckedChange={setMockMode} />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>{t('themeLabel')}</Label>
              <Select value={theme} onValueChange={(v) => setTheme(v as 'dark' | 'light' | 'system')}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder={t('themeLight')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">{t('themeLight')}</SelectItem>
                  <SelectItem value="dark">{t('themeDark')}</SelectItem>
                  <SelectItem value="system">{t('themeSystem')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>{t('refreshIntervalLabel')}</Label>
                <span className="text-sm text-muted-foreground">{refreshInterval}s</span>
              </div>
              <Slider
                value={[refreshInterval]}
                onValueChange={(v) => setRefreshInterval(v[0])}
                min={5}
                max={300}
                step={5}
              />
              <p className="text-xs text-muted-foreground">{t('refreshIntervalHint')}</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* GitHub Account */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('githubAccountTitle')}</CardTitle>
            <CardDescription>{t('githubAccountDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="default-username">{t('defaultUsernameLabel')}</Label>
              <Input
                id="default-username"
                value={defaultUsername}
                onChange={(e) => setDefaultUsername(e.target.value)}
                placeholder="e.g. torvalds"
              />
              <p className="text-xs text-muted-foreground">{t('defaultUsernameHint')}</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* API Tokens */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('tokensTitle')}</CardTitle>
            <CardDescription>{t('tokensDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gh-token">{t('ghTokenLabel')}</Label>
              <div className="relative">
                <Input
                  id="gh-token"
                  type={showGhToken ? 'text' : 'password'}
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxx"
                  className="pr-10"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowGhToken((v) => !v)}
                >
                  {showGhToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{t('ghTokenHint')}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ph-token">{t('phTokenLabel')}</Label>
              <div className="relative">
                <Input
                  id="ph-token"
                  type={showPhToken ? 'text' : 'password'}
                  value={phToken}
                  onChange={(e) => setPhToken(e.target.value)}
                  placeholder="xxxxxxxxxxxx"
                  className="pr-10"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPhToken((v) => !v)}
                >
                  {showPhToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{t('phTokenHint')}</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Environment Info */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('envTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Mock Mode</span>
              <span className="font-mono text-xs">{mockMode ? 'Enabled' : 'Disabled'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">API URL</span>
              <span className="font-mono text-xs">{apiUrl}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Default Username</span>
              <span className="font-mono text-xs">{defaultUsername || '(none)'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Refresh Interval</span>
              <span className="font-mono text-xs">{refreshInterval}s</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Save Button */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex justify-end"
      >
        <Button onClick={handleSave} className="gap-2">
          <Save className="h-4 w-4" />
          {savedToast ? t('saved') : t('saveSettings')}
        </Button>
      </motion.div>
    </div>
  );
}
