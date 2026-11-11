import { useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { App, ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { ThemeContext } from './theme-context';

export function AppProviders({ children }: PropsWithChildren) {
  const [dark, setDark] = useState(false);
  const settings = useMemo(() => ({ dark, setDark }), [dark]);
  return (
    <ThemeContext.Provider value={settings}>
      <ConfigProvider
        locale={zhCN}
        theme={{
          algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
          token: {
            colorPrimary: '#3158d4',
            borderRadius: 10,
            fontFamily: '"Segoe UI", "Microsoft YaHei", sans-serif',
          },
        }}
      >
        <App>{children}</App>
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}
