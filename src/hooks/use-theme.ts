import { useContext } from 'react';
import { ThemeContext } from '@/app/theme-context';
import type { ThemeSettings } from '@/app/theme-context';

export function useTheme(): ThemeSettings {
  const settings = useContext(ThemeContext);
  if (!settings) throw new Error('主题设置需要 AppProviders');
  return settings;
}
