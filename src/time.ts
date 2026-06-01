import type { DeskPetSettings, Weekday } from './types';

const JS_DAY_TO_WEEKDAY: Weekday[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function isInsideWorkWindow(now: Date, settings: DeskPetSettings) {
  const weekday = JS_DAY_TO_WEEKDAY[now.getDay()];
  if (!settings.workDays.includes(weekday)) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = toMinutes(settings.workStart);
  const endMinutes = toMinutes(settings.workEnd);

  if (startMinutes === endMinutes) return true;
  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  // 支持跨午夜工作窗口，例如 22:00-06:00。
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

export function secondsUntil(target: number) {
  return Math.max(0, Math.ceil((target - Date.now()) / 1000));
}

export function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function toMinutes(time: string) {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}
