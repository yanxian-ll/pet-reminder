import type { DeskPetSettings, EventReminder } from './types';

export const DEFAULT_SETTINGS: DeskPetSettings = {
  workDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  workStart: '09:00',
  workEnd: '18:00',
  focusMinutes: 20,
  breakMinutes: 2,
  breakPetCount: 60,
  eventReminders: [],
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
    workEnd: normalizeTime(settings.workEnd, DEFAULT_SETTINGS.workEnd),
    eventReminders: normalizeEventReminders(settings.eventReminders),
    strictBreakOverlay: true,
    allowEscExit: true
  };
}

function clampInteger(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function normalizeTime(value: string, fallback: string) {
  const parts = value.split(':');
  if (parts.length !== 2) return fallback;
  const hour = Number(parts[0]);
  const minute = Number(parts[1]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return fallback;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback;
  return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
}

function normalizeEventReminders(value: EventReminder[] | undefined) {
  if (!Array.isArray(value)) return [];

  return value
    .map((reminder, index) => {
      const title = typeof reminder.title === 'string' ? reminder.title.trim().slice(0, 40) : '';

      return {
        id: typeof reminder.id === 'string' && reminder.id ? reminder.id : `event-${index}`,
        time: normalizeTime(reminder.time, '09:00'),
        title: title || '未命名事件',
        enabled: reminder.enabled !== false
      };
    })
    .filter((reminder): reminder is EventReminder => Boolean(reminder))
    .slice(0, 12);
}
