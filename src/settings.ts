import type { DeskPetSettings } from './types';

export const DEFAULT_SETTINGS: DeskPetSettings = {
  workDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  workStart: '09:00',
  workEnd: '18:00',
  focusMinutes: 20,
  breakMinutes: 2,
  breakPetCount: 60,
  autoStart: false,
  strictBreakOverlay: true,
  allowEscExit: true
};

const STORAGE_KEY = 'deskpet-rest-reminder.settings.v1';

export function loadSettings(): DeskPetSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<DeskPetSettings>;
    return sanitizeSettings({ ...DEFAULT_SETTINGS, ...parsed });
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: DeskPetSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeSettings(settings)));
}

export function sanitizeSettings(settings: DeskPetSettings): DeskPetSettings {
  return {
    ...settings,
    focusMinutes: clampInteger(settings.focusMinutes, 5, 180),
    breakMinutes: clampInteger(settings.breakMinutes, 1, 60),
    breakPetCount: clampInteger(settings.breakPetCount, 60, 200),
    workStart: normalizeTime(settings.workStart, DEFAULT_SETTINGS.workStart),
    workEnd: normalizeTime(settings.workEnd, DEFAULT_SETTINGS.workEnd)
  };
}

function clampInteger(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function normalizeTime(value: string, fallback: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : fallback;
}
