'use client';

import { useTheme } from 'next-themes';
import { ThemeSwitcher } from './theme-switcher';
import { useAuthStore } from '@/lib/stores/use-auth-store';

export function ThemeSelector() {
  const { setTheme, theme } = useTheme();
  const { user, valyuAccessToken } = useAuthStore();

  // User has access if signed in with Valyu
  const hasAccess = !!user && !!valyuAccessToken;

  return (
    <ThemeSwitcher
      value={theme as 'light' | 'dark' | 'system'}
      onChange={(newTheme) => setTheme(newTheme)}
      defaultValue="light"
      requiresSubscription={true}
      hasSubscription={hasAccess}
    />
  );
}

export function CompactThemeSelector({
  onUpgradeClick,
  sessionId
}: {
  onUpgradeClick?: () => void;
  sessionId?: string;
}) {
  const { setTheme, theme } = useTheme();
  const { user, valyuAccessToken } = useAuthStore();

  // User has access if signed in with Valyu
  const hasAccess = !!user && !!valyuAccessToken;

  return (
    <ThemeSwitcher
      value={theme as 'light' | 'dark' | 'system'}
      onChange={(newTheme) => setTheme(newTheme)}
      defaultValue="light"
      className="h-8 scale-75"
      requiresSubscription={true}
      hasSubscription={hasAccess}
      onUpgradeClick={onUpgradeClick}
      userId={user?.id}
      sessionId={sessionId}
      tier={hasAccess ? 'paid' : 'free'}
    />
  );
}

export function ThemeMenuItem() {
  const { setTheme, theme } = useTheme();
  const { user, valyuAccessToken } = useAuthStore();

  // User has access if signed in with Valyu
  const hasAccess = !!user && !!valyuAccessToken;

  return (
    <ThemeSwitcher
      value={theme as 'light' | 'dark' | 'system'}
      onChange={(newTheme) => setTheme(newTheme)}
      defaultValue="light"
      requiresSubscription={true}
      hasSubscription={hasAccess}
    />
  );
}
