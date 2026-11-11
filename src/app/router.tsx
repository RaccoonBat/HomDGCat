import { createBrowserRouter } from 'react-router-dom';
import { SiteLayout } from '@/layouts/site-layout';
import { HomePage } from '@/pages/home/home-page';
import { NotFoundPage } from '@/pages/not-found/not-found-page';
import { CollectionPage } from '@/pages/encyclopedia/collection-page';
import { DetailPage } from '@/pages/encyclopedia/detail-page';
import { MonsterListPage } from '@/pages/monsters/monster-list-page';
import { MonsterDetailPage } from '@/pages/monsters/monster-detail-page';
import { ReferenceListPage } from '@/pages/reference/list-page';
import { ReferenceDetailPage } from '@/pages/reference/detail-page';
import { DialoguePage, DialogueDetailPage } from '@/pages/dialogues';

export const router = createBrowserRouter([
  {
    element: <SiteLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'sr/characters', element: <CollectionPage key="characters" category="characters" /> },
      { path: 'sr/characters/:id', element: <DetailPage category="characters" /> },
      { path: 'sr/char/:id', element: <DetailPage category="characters" /> },
      {
        path: 'sr/light-cones',
        element: <CollectionPage key="light-cones" category="light-cones" />,
      },
      { path: 'sr/light-cones/:id', element: <DetailPage category="light-cones" /> },
      { path: 'sr/monsters', element: <MonsterListPage /> },
      { path: 'sr/monsters/:id', element: <MonsterDetailPage /> },
      { path: 'sr/monster', element: <MonsterListPage /> },
      { path: 'sr/monster/:id', element: <MonsterDetailPage /> },
      { path: 'sr/readables', element: <ReferenceListPage key="readables" category="readables" /> },
      { path: 'sr/readables/:id', element: <ReferenceDetailPage category="readables" /> },
      { path: 'sr/readable', element: <ReferenceListPage key="readable" category="readables" /> },
      { path: 'sr/readable/:id', element: <ReferenceDetailPage category="readables" /> },
      {
        path: 'sr/achievements',
        element: <ReferenceListPage key="achievements" category="achievements" />,
      },
      { path: 'sr/achievements/:id', element: <ReferenceDetailPage category="achievements" /> },
      { path: 'sr/ach', element: <ReferenceListPage key="ach" category="achievements" /> },
      { path: 'sr/ach/:id', element: <ReferenceDetailPage category="achievements" /> },
      { path: 'sr/records', element: <ReferenceListPage key="records" category="records" /> },
      { path: 'sr/records/:id', element: <ReferenceDetailPage category="records" /> },
      { path: 'sr/dialogues', element: <DialoguePage /> },
      { path: 'sr/dialogues/:id', element: <DialogueDetailPage /> },
      { path: 'sr/stories', element: <DialoguePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
