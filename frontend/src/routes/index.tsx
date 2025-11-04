import { createBrowserRouter } from 'react-router-dom';

import { AppLayout } from '../ui/AppLayout';
import { DashboardPage } from '../ui/pages/DashboardPage';
import { ModelsPage } from '../ui/pages/ModelsPage';
import { WorkspacePage } from '../ui/pages/WorkspacePage';
import { SettingsPage } from '../ui/pages/SettingsPage';
import { ChatPage } from '../ui/pages/ChatPage';
import { ImagePage } from '../ui/pages/ImagePage';
import { AudioPage } from '../ui/pages/AudioPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'chat', element: <ChatPage /> },
      { path: 'image', element: <ImagePage /> },
      { path: 'audio', element: <AudioPage /> },
      { path: 'models', element: <ModelsPage /> },
      { path: 'workspace/:modality/:modelId', element: <WorkspacePage /> },
      { path: 'settings', element: <SettingsPage /> }
    ]
  }
]);
