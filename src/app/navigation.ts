/** 首页入口与公共导航共用的已迁移分类。 */
interface NavigationItem {
  /** 分类的中文菜单名称。 */
  label: string;
  /** React 路由中的规范列表地址。 */
  path: string;
}

/** 只列出已接通 React 页面的分类。 */
export const navigationItems: readonly NavigationItem[] = [
  { label: '角色', path: '/sr/characters' },
  { label: '光锥', path: '/sr/light-cones' },
  { label: '遗器', path: '/sr/relics' },
  { label: '怪物', path: '/sr/monsters' },
  { label: '阅读物', path: '/sr/readables' },
  { label: '对话', path: '/sr/dialogues' },
  { label: '成就', path: '/sr/achievements' },
  { label: '唱片', path: '/sr/records' },
];
