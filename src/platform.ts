import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauriRuntime } from './windowController';

let lastTooltip = '';

export async function showSettingsWindow() {
  if (!isTauriRuntime()) return;
  await invoke('show_settings_window');
}

export async function hideCurrentWindow() {
  if (!isTauriRuntime()) return;
  await getCurrentWindow().hide();
}

export async function sendAppCommand(command: string) {
  if (!isTauriRuntime()) return;
  await emit('app-command', command);
}

export async function showNativeNotification(title: string, body: string, enabled: boolean) {
  if (!enabled || !isTauriRuntime()) return;
  try {
    await invoke('show_native_notification', { title, body });
  } catch (error) {
    console.warn('Native notification failed:', error);
  }
}

export async function getSystemIdleSeconds() {
  if (!isTauriRuntime()) return 0;
  try {
    return await invoke<number>('get_system_idle_seconds');
  } catch (error) {
    console.warn('System idle time unavailable:', error);
    return 0;
  }
}

export async function updateTrayTooltip(tooltip: string) {
  if (!isTauriRuntime() || tooltip === lastTooltip) return;
  lastTooltip = tooltip;
  try {
    await invoke('update_tray_tooltip', { tooltip });
  } catch (error) {
    console.warn('Tray tooltip update failed:', error);
  }
}
