import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow, LogicalPosition, LogicalSize } from '@tauri-apps/api/window';

export type WindowPresentation = 'hidden' | 'companion' | 'break';

interface WindowRequest {
  presentation: WindowPresentation;
  focus?: boolean;
}

class WindowController {
  private queue: Promise<void> = Promise.resolve();
  private latestRequestId = 0;
  private configured = false;
  private lastPresentation: WindowPresentation | null = null;
  private breakEnforcementEnabled = false;

  request(request: WindowRequest) {
    if (!isTauriRuntime()) return;
    const requestId = ++this.latestRequestId;
    this.queue = this.queue
      .catch(() => undefined)
      .then(async () => {
        if (requestId !== this.latestRequestId) return;
        await this.apply(request);
      });
  }

  private async setBreakEnforcement(enabled: boolean) {
    if (this.breakEnforcementEnabled === enabled) return;
    await invoke('set_break_enforcement', { enabled });
    this.breakEnforcementEnabled = enabled;
  }

  private async apply({ presentation, focus = false }: WindowRequest) {
    const appWindow = getCurrentWindow();

    try {
      if (!this.configured) {
        await appWindow.setAlwaysOnTop(true);
        await appWindow.setDecorations(false);
        await appWindow.setResizable(false);
        this.configured = true;
      }

      if (presentation === 'hidden') {
        await this.setBreakEnforcement(false);
        if (this.lastPresentation !== 'hidden') await appWindow.hide();
        this.lastPresentation = presentation;
        return;
      }

      if (presentation === 'break') {
        await invoke('fit_main_window_to_all_monitors');
        await appWindow.show();
        await appWindow.setFocus();
        await this.setBreakEnforcement(true);
      } else {
        await this.setBreakEnforcement(false);
        const width = 236;
        const height = 236;
        const x = Math.max(16, window.screen.availWidth - width - 28);
        const y = Math.max(16, window.screen.availHeight - height - 44);
        await appWindow.setSize(new LogicalSize(width, height));
        await appWindow.setPosition(new LogicalPosition(x, y));
        await appWindow.show();
        if (focus) await appWindow.setFocus();
      }

      this.lastPresentation = presentation;
    } catch (error) {
      console.warn('Failed to update Tauri window:', error);
    }
  }
}

export const windowController = new WindowController();

export function isTauriRuntime() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}
