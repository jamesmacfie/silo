import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryProvider } from '@/ui/shared/providers/QueryProvider';
import { ThemeProvider } from '@/ui/shared/contexts/ThemeContext';
import { PopupApp } from '@/ui/popup/components/PopupApp';
import '@/ui/popup/index.css';

const mount = document.getElementById('root');
if (mount) {
  const root = createRoot(mount);
  root.render(
    <React.StrictMode>
      <ThemeProvider>
        <QueryProvider>
          <PopupApp />
        </QueryProvider>
      </ThemeProvider>
    </React.StrictMode>,
  );
}


