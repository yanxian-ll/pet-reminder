import { useCallback, useEffect, useRef, useState } from 'react';
import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart';
import { emit } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { SettingsPanel } from './components/SettingsPanel';
import { hideCurrentWindow, sendAppCommand } from './platform';
import { DEFAULT_SETTINGS, loadSettings, sanitizeSettings, saveSettings } from './settings';
import type { DeskPetSettings, EventReminder, Weekday } from './types';
import { isTauriRuntime } from './windowController';

export default function SettingsApp() {
  const [settings, setSettings] = useState<DeskPetSettings>(() => loadSettings());
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      if (isTauriRuntime()) {
        void isEnabled()
          .then((autoStart) => {
            setSettings((current) => ({ ...current, autoStart }));
          })
          .catch((error) => console.warn('Autostart state unavailable:', error));
      }
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const sanitized = sanitizeSettings(settings);
      saveSettings(sanitized);
      if (isTauriRuntime()) void emit('settings-updated', sanitized);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [settings]);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    const appWindow = getCurrentWindow();
    const unlistenPromise = appWindow.onCloseRequested((event) => {
      event.preventDefault();
      void appWindow.hide();
    });
    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') void hideCurrentWindow();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const updateSettings = useCallback((patch: Partial<DeskPetSettings>) => {
    setSettings((current) => sanitizeSettings({ ...current, ...patch }));
  }, []);

  const toggleAutoStart = useCallback(async () => {
    const next = !settings.autoStart;
    setSettings((current) => ({ ...current, autoStart: next }));
    if (!isTauriRuntime()) return;
    try {
      if (next) await enable();
      else await disable();
    } catch (error) {
      console.warn('Failed to change autostart:', error);
      setSettings((current) => ({ ...current, autoStart: !next }));
    }
  }, [settings.autoStart]);

  const toggleWeekday = useCallback((day: Weekday) => {
    setSettings((current) => ({
      ...current,
      workDays: current.workDays.includes(day)
        ? current.workDays.filter((item) => item !== day)
        : [...current.workDays, day]
    }));
  }, []);

  const addEventReminder = useCallback(() => {
    const reminder: EventReminder = {
      id: `event-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      time: '09:00',
      title: '新的事件提醒',
      enabled: true
    };
    setSettings((current) => ({ ...current, eventReminders: [...current.eventReminders, reminder] }));
  }, []);

  const updateEventReminder = useCallback((id: string, patch: Partial<EventReminder>) => {
    setSettings((current) => ({
      ...current,
      eventReminders: current.eventReminders.map((reminder) => reminder.id === id ? { ...reminder, ...patch } : reminder)
    }));
  }, []);

  const deleteEventReminder = useCallback((id: string) => {
    setSettings((current) => ({
      ...current,
      eventReminders: current.eventReminders.filter((reminder) => reminder.id !== id)
    }));
  }, []);

  const exportSettings = useCallback(() => {
    const blob = new Blob([JSON.stringify(sanitizeSettings(settings), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `deskpet-settings-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [settings]);

  const importSettings = useCallback(async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as Partial<DeskPetSettings>;
      setSettings(sanitizeSettings({ ...DEFAULT_SETTINGS, ...parsed }));
    } catch (error) {
      console.warn('Settings import failed:', error);
      window.alert('配置文件格式不正确。');
    }
  }, []);

  return (
    <main className="settings-window">
      <SettingsPanel
        settings={settings}
        onClose={() => void hideCurrentWindow()}
        onToggleAutoStart={toggleAutoStart}
        onUpdateSettings={updateSettings}
        onToggleWeekday={toggleWeekday}
        onAddEventReminder={addEventReminder}
        onUpdateEventReminder={updateEventReminder}
        onDeleteEventReminder={deleteEventReminder}
        onStartBreak={() => void sendAppCommand('break-now')}
        onPauseToggle={() => void sendAppCommand('pause-toggle')}
        onDoNotDisturb={() => void sendAppCommand('dnd-30')}
        onExportSettings={exportSettings}
        onImportSettings={importSettings}
      />
    </main>
  );
}
