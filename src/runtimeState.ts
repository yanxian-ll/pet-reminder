const DND_STORAGE_KEY = 'deskpet-rest-reminder.dnd-until.v1';

export function loadDoNotDisturbUntil() {
  const value = Number(localStorage.getItem(DND_STORAGE_KEY));
  return Number.isFinite(value) && value > Date.now() ? value : 0;
}

export function saveDoNotDisturbUntil(timestamp: number) {
  if (timestamp > Date.now()) localStorage.setItem(DND_STORAGE_KEY, String(timestamp));
  else localStorage.removeItem(DND_STORAGE_KEY);
}
