import React from 'react';
import ReactDOM from 'react-dom/client';
import { getCurrentWindow } from '@tauri-apps/api/window';
import App from './App';
import SettingsApp from './SettingsApp';
import { isTauriRuntime } from './windowController';
import './styles.css';

const windowLabel = isTauriRuntime() ? getCurrentWindow().label : 'main';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {windowLabel === 'settings' ? <SettingsApp /> : <App />}
  </React.StrictMode>
);
