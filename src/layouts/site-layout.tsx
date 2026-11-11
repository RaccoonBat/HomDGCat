import { Layout, Switch, Typography } from 'antd';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useTheme } from '@/hooks/use-theme';
import styles from './site-layout.module.scss';
import { navigationItems } from '@/app/navigation';

export function SiteLayout() {
  const { dark, setDark } = useTheme();
  return (
    <Layout className={styles.layout}>
      <Layout.Header className={styles.header}>
        <Link to="/" className={styles.brand}>
          崩坏·星穹铁道WIKI
        </Link>
        <label className={styles.appearance}>
          <span>深色模式</span>
          <Switch checked={dark} onChange={setDark} aria-label="深色模式" />
        </label>
      </Layout.Header>
      <nav className={styles.navigation} aria-label="资料分类">
        <NavLink to="/" end>
          首页
        </NavLink>
        {navigationItems.map((item) => (
          <NavLink key={item.path} to={item.path}>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <Layout.Content className={styles.content}>
        <Outlet />
      </Layout.Content>
      <Layout.Footer className={styles.footer}>
        <Typography.Text type="secondary">游戏内容与素材版权归各自权利人所有</Typography.Text>
      </Layout.Footer>
    </Layout>
  );
}
