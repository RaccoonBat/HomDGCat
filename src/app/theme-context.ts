import { createContext } from 'react';

/** 全站主题状态，由 ThemeContext 提供。 */
export interface ThemeSettings {
  /** 是否启用 Ant Design 深色主题。 */
  dark: boolean;
  /** 切换并持久化主题偏好。 */
  setDark: (dark: boolean) => void;
}

export const ThemeContext = createContext<ThemeSettings | null>(null);
