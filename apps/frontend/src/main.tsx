import React from 'react';
import ReactDOM from 'react-dom/client';
import { ColorSchemeProvider, ConfigProvider } from '@vkontakte/vkui';
import '@vkontakte/vkui/dist/vkui.css';
import './styles/global.css';
import { App } from './app/App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider>
      <ColorSchemeProvider value="dark">
        <App />
      </ColorSchemeProvider>
    </ConfigProvider>
  </React.StrictMode>,
);
