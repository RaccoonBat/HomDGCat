import { Alert, Button, Card, Col, Row, Skeleton, Space, Statistic, Tag, Typography } from 'antd';
import { useManifest } from '@/hooks/use-manifest';
import styles from './home-page.module.scss';
import { Link } from 'react-router-dom';
import { navigationItems } from '@/app/navigation';

const languages = { CH: '简体中文', EN: 'English', JP: '日本語', KR: '한국어' };

export function HomePage() {
  const { state, retry } = useManifest();
  return (
    <section className={styles.page}>
      <div className={styles.introduction}>
        <Typography.Text type="secondary">资料概览</Typography.Text>
        <Typography.Title>欢迎来到崩铁Wiki</Typography.Title>
        <Typography.Paragraph type="secondary">
          角色、光锥、怪物与旅途中的文字，共用一份资料库。
        </Typography.Paragraph>
      </div>
      {state.status === 'loading' && (
        <Card>
          <Skeleton active />
        </Card>
      )}
      {state.status === 'error' && (
        <Alert
          type="error"
          title="暂时无法加载资料"
          description={state.message}
          action={<Button onClick={retry}>重试</Button>}
        />
      )}
      {state.status === 'success' && (
        <>
          <Space wrap className={styles.summary}>
            <Tag color="blue">数据版本 {state.data.version}</Tag>
            {state.data.languages.map((language) => (
              <Tag key={language}>{languages[language]}</Tag>
            ))}
          </Space>
          <Row gutter={[20, 20]}>
            {[
              {
                title: '角色记录',
                value:
                  (state.data.tables.AvatarConfig?.rows ?? 0) +
                  (state.data.tables.AvatarConfigLD?.rows ?? 0),
              },
              { title: '光锥记录', value: state.data.tables.EquipmentConfig?.rows ?? 0 },
              { title: '怪物模板', value: state.data.tables.MonsterTemplateConfig?.rows ?? 0 },
              { title: '阅读物系列', value: state.data.tables.BookSeriesConfig?.rows ?? 0 },
            ].map((item) => (
              <Col key={item.title} xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic title={item.title} value={item.value} />
                </Card>
              </Col>
            ))}
          </Row>
          <Card title="资料分类" className={styles.categories}>
            <Space wrap>
              {navigationItems.map((item) => (
                <Link key={item.path} to={item.path}>
                  <Button>{item.label}</Button>
                </Link>
              ))}
            </Space>
          </Card>
        </>
      )}
    </section>
  );
}
