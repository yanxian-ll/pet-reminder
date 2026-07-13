import type { EventReminder } from './types';

const TRIGGERED_STORAGE_KEY = 'deskpet-rest-reminder.triggered-events.v1';
const LAST_CHECKED_STORAGE_KEY = 'deskpet-rest-reminder.last-event-check.v1';
const MAX_CATCH_UP_MS = 12 * 60 * 60 * 1000;
const RETENTION_MS = 8 * 24 * 60 * 60 * 1000;

export interface DueEventReminder {
  reminder: EventReminder;
  key: string;
  dueAt: number;
}

export function loadTriggeredReminderKeys(now = Date.now()) {
  try {
    const raw = localStorage.getItem(TRIGGERED_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) as string[] : [];
    const cutoff = now - RETENTION_MS;
    return new Set(parsed.filter((key) => reminderDateFromKey(key) >= cutoff));
  } catch {
    return new Set<string>();
  }
}

export function saveTriggeredReminderKeys(keys: Set<string>) {
  localStorage.setItem(TRIGGERED_STORAGE_KEY, JSON.stringify([...keys]));
}

export function loadLastReminderCheck(now = Date.now()) {
  const fallback = now - 60_000;
  try {
    const stored = Number(localStorage.getItem(LAST_CHECKED_STORAGE_KEY));
    if (!Number.isFinite(stored)) return fallback;
    return Math.max(stored, now - MAX_CATCH_UP_MS);
  } catch {
    return fallback;
  }
}

export function saveLastReminderCheck(timestamp: number) {
  localStorage.setItem(LAST_CHECKED_STORAGE_KEY, String(timestamp));
}

export function findDueEventReminders(
  reminders: EventReminder[],
  previousCheck: number,
  now: number,
  triggeredKeys: Set<string>
): DueEventReminder[] {
  if (now <= previousCheck) return [];

  const start = Math.max(previousCheck, now - MAX_CATCH_UP_MS);
  const firstDay = startOfLocalDay(start);
  const lastDay = startOfLocalDay(now);
  const due: DueEventReminder[] = [];

  for (let day = firstDay; day <= lastDay; day = addLocalDay(day)) {
    for (const reminder of reminders) {
      if (!reminder.enabled) continue;
      const dueAt = timestampForReminder(day, reminder.time);
      if (dueAt <= start || dueAt > now) continue;

      const key = reminderKey(dueAt, reminder.id);
      if (triggeredKeys.has(key)) continue;
      due.push({ reminder, key, dueAt });
    }
  }

  return due.sort((left, right) => left.dueAt - right.dueAt);
}

function timestampForReminder(dayStart: number, time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date(dayStart);
  date.setHours(hours, minutes, 0, 0);
  return date.getTime();
}

function reminderKey(timestamp: number, reminderId: string) {
  const date = new Date(timestamp);
  const day = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
  return `${day}:${reminderId}`;
}

function reminderDateFromKey(key: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2}):/.exec(key);
  if (!match) return 0;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime();
}

function startOfLocalDay(timestamp: number) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function addLocalDay(dayStart: number) {
  const date = new Date(dayStart);
  date.setDate(date.getDate() + 1);
  return date.getTime();
}
