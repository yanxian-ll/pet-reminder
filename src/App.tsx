import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { playBreakChime } from './audio';
import { BreakScreen } from './components/BreakScreen';
import { CompanionPanel } from './components/CompanionPanel';
import { createPetSeeds } from './pets';
import {
  getSystemIdleSeconds,
  showNativeNotification,
  showSettingsWindow,
  updateTrayTooltip
} from './platform';
import {
  findDueEventReminders,
  loadLastReminderCheck,
  loadTriggeredReminderKeys,
  saveLastReminderCheck,
  saveTriggeredReminderKeys
} from './reminderScheduler';
import { loadDoNotDisturbUntil, saveDoNotDisturbUntil } from './runtimeState';
import { loadSettings, sanitizeSettings, saveSettings } from './settings';
import { formatDuration, isInsideWorkWindow, secondsUntil } from './time';
import type { DeskPetSettings, EventReminder, PetMode } from './types';
import { isTauriRuntime, windowController } from './windowController';

type VisibilityReason = 'visible' | 'hidden-by-user' | 'hidden-outside-work-hours';
interface SnoozedReminder { reminder: EventReminder; dueAt: number }

export default function App() {
  const [settings, setSettingsState] = useState<DeskPetSettings>(() => loadSettings());
  const [mode, setMode] = useState<PetMode>('idle');
  const [phaseEnd, setPhaseEnd] = useState(() => Date.now() + settings.focusMinutes * 60_000);
  const [remainingSeconds, setRemainingSeconds] = useState(() => secondsUntil(phaseEnd));
  const [salt, setSalt] = useState(() => Math.floor(Math.random() * 10_000));
  const [activeEventReminder, setActiveEventReminder] = useState<EventReminder | null>(null);
  const [doNotDisturbUntil, setDoNotDisturbUntil] = useState(() => loadDoNotDisturbUntil());

  const settingsRef = useRef(settings);
  const modeRef = useRef<PetMode>(mode);
  const phaseEndRef = useRef(phaseEnd);
  const activeEventReminderRef = useRef<EventReminder | null>(activeEventReminder);
  const visibilityReasonRef = useRef<VisibilityReason>('visible');
  const pendingEventRemindersRef = useRef<EventReminder[]>([]);
  const snoozedEventRemindersRef = useRef<SnoozedReminder[]>([]);
  const triggeredEventRemindersRef = useRef(loadTriggeredReminderKeys());
  const lastReminderCheckRef = useRef(loadLastReminderCheck());
  const lastPersistedReminderCheckRef = useRef(lastReminderCheckRef.current);
  const initializedRef = useRef(false);
  const pausedRemainingMsRef = useRef<number | null>(null);
  const doNotDisturbUntilRef = useRef(doNotDisturbUntil);
  const idleResetArmedRef = useRef(false);

  const pets = useMemo(
    () => createPetSeeds(settings.breakPetCount, salt),
    [settings.breakPetCount, salt]
  );

  const setModeValue = useCallback((nextMode: PetMode) => {
    modeRef.current = nextMode;
    setMode(nextMode);
  }, []);

  const setPhaseEndValue = useCallback((timestamp: number) => {
    phaseEndRef.current = timestamp;
    setPhaseEnd(timestamp);
    setRemainingSeconds(secondsUntil(timestamp));
  }, []);

  const setActiveEventReminderValue = useCallback((reminder: EventReminder | null) => {
    activeEventReminderRef.current = reminder;
    setActiveEventReminder(reminder);
  }, []);

  const setDoNotDisturbUntilValue = useCallback((timestamp: number) => {
    doNotDisturbUntilRef.current = timestamp;
    setDoNotDisturbUntil(timestamp);
    saveDoNotDisturbUntil(timestamp);
  }, []);

  const presentWindow = useCallback((nextMode: PetMode, force = false) => {
    if (nextMode === 'break') {
      windowController.request({ presentation: 'break', focus: true });
      return;
    }
    if (!force && visibilityReasonRef.current !== 'visible') {
      windowController.request({ presentation: 'hidden' });
      return;
    }
    windowController.request({ presentation: 'companion', focus: force });
  }, []);

  const showEventReminder = useCallback((reminder: EventReminder, playSound = true) => {
    setActiveEventReminderValue(reminder);
    visibilityReasonRef.current = 'visible';
    presentWindow(modeRef.current === 'break' ? 'work' : modeRef.current, true);
    if (playSound) void playBreakChime();
    void showNativeNotification('事件提醒', reminder.title, settingsRef.current.notificationsEnabled);
  }, [presentWindow, setActiveEventReminderValue]);

  const showNextQueuedReminder = useCallback(() => {
    if (Date.now() < doNotDisturbUntilRef.current || modeRef.current === 'break') return false;
    const next = pendingEventRemindersRef.current.shift() ?? null;
    if (!next) return false;
    showEventReminder(next);
    return true;
  }, [showEventReminder]);

  const startWork = useCallback((minutes = settingsRef.current.focusMinutes) => {
    const now = new Date();
    const nextMode: PetMode = isInsideWorkWindow(now, settingsRef.current) ? 'work' : 'idle';
    pausedRemainingMsRef.current = null;
    setModeValue(nextMode);
    setPhaseEndValue(Date.now() + minutes * 60_000);
    setSalt((value) => value + 1);
    setActiveEventReminderValue(null);

    if (nextMode === 'idle') {
      visibilityReasonRef.current = 'hidden-outside-work-hours';
      windowController.request({ presentation: 'hidden' });
      return;
    }

    visibilityReasonRef.current = 'visible';
    presentWindow(nextMode);
    showNextQueuedReminder();
  }, [presentWindow, setActiveEventReminderValue, setModeValue, setPhaseEndValue, showNextQueuedReminder]);

  const startBreak = useCallback((minutes = settingsRef.current.breakMinutes, manual = false) => {
    const nowMs = Date.now();
    if (!manual && doNotDisturbUntilRef.current > nowMs) {
      setPhaseEndValue(doNotDisturbUntilRef.current);
      return;
    }

    if (activeEventReminderRef.current) {
      pendingEventRemindersRef.current.unshift(activeEventReminderRef.current);
    }

    setModeValue('break');
    setActiveEventReminderValue(null);
    setPhaseEndValue(nowMs + minutes * 60_000);
    setSalt((value) => value + 1);
    visibilityReasonRef.current = 'visible';
    presentWindow('break', true);
    void playBreakChime();
    void showNativeNotification('休息时间到', '站起来走一走，看看远处，喝口水。', settingsRef.current.notificationsEnabled);
  }, [presentWindow, setActiveEventReminderValue, setModeValue, setPhaseEndValue]);

  const extendBreak = useCallback((minutes: number) => {
    setModeValue('break');
    setPhaseEndValue(Math.max(phaseEndRef.current, Date.now()) + minutes * 60_000);
    visibilityReasonRef.current = 'visible';
    presentWindow('break', true);
  }, [presentWindow, setModeValue, setPhaseEndValue]);

  const pauseToggle = useCallback(() => {
    if (modeRef.current === 'work') {
      pausedRemainingMsRef.current = Math.max(1000, phaseEndRef.current - Date.now());
      setModeValue('paused');
      setRemainingSeconds(Math.ceil(pausedRemainingMsRef.current / 1000));
      visibilityReasonRef.current = 'visible';
      presentWindow('paused', true);
      return;
    }

    if (modeRef.current === 'paused') {
      if (!isInsideWorkWindow(new Date(), settingsRef.current)) {
        setModeValue('idle');
        visibilityReasonRef.current = 'hidden-outside-work-hours';
        windowController.request({ presentation: 'hidden' });
        return;
      }
      const remaining = pausedRemainingMsRef.current ?? settingsRef.current.focusMinutes * 60_000;
      pausedRemainingMsRef.current = null;
      setModeValue('work');
      setPhaseEndValue(Date.now() + remaining);
      visibilityReasonRef.current = 'visible';
      presentWindow('work', true);
    }
  }, [presentWindow, setModeValue, setPhaseEndValue]);

  const activateDoNotDisturb = useCallback((minutes = 30) => {
    const until = Date.now() + minutes * 60_000;
    setDoNotDisturbUntilValue(until);
    if (modeRef.current === 'work' && phaseEndRef.current < until) setPhaseEndValue(until);
    if (activeEventReminderRef.current) {
      pendingEventRemindersRef.current.unshift(activeEventReminderRef.current);
      setActiveEventReminderValue(null);
    }
    visibilityReasonRef.current = 'visible';
    presentWindow(modeRef.current, true);
  }, [presentWindow, setActiveEventReminderValue, setDoNotDisturbUntilValue, setPhaseEndValue]);

  const dismissEventReminder = useCallback(() => {
    setActiveEventReminderValue(null);
    if (showNextQueuedReminder()) return;
    if (!isInsideWorkWindow(new Date(), settingsRef.current)) {
      visibilityReasonRef.current = 'hidden-outside-work-hours';
      windowController.request({ presentation: 'hidden' });
      return;
    }
    visibilityReasonRef.current = 'visible';
    presentWindow(modeRef.current);
  }, [presentWindow, setActiveEventReminderValue, showNextQueuedReminder]);

  const snoozeEventReminder = useCallback((minutes = 10) => {
    const reminder = activeEventReminderRef.current;
    if (reminder) snoozedEventRemindersRef.current.push({ reminder, dueAt: Date.now() + minutes * 60_000 });
    dismissEventReminder();
  }, [dismissEventReminder]);

  const hideCompanionPanel = useCallback(() => {
    if (modeRef.current === 'break') return;
    visibilityReasonRef.current = 'hidden-by-user';
    windowController.request({ presentation: 'hidden' });
  }, []);

  useEffect(() => {
    settingsRef.current = settings;
    const timer = window.setTimeout(() => saveSettings(settings), 300);
    return () => window.clearTimeout(timer);
  }, [settings]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    startWork();
  }, [startWork]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = new Date();
      const nowMs = now.getTime();
      const currentSettings = settingsRef.current;
      const currentMode = modeRef.current;
      const insideWork = isInsideWorkWindow(now, currentSettings);

      const dueReminders = findDueEventReminders(
        currentSettings.eventReminders,
        lastReminderCheckRef.current,
        nowMs,
        triggeredEventRemindersRef.current
      );
      lastReminderCheckRef.current = nowMs;

      const snoozedDue = snoozedEventRemindersRef.current.filter((item) => item.dueAt <= nowMs);
      snoozedEventRemindersRef.current = snoozedEventRemindersRef.current.filter((item) => item.dueAt > nowMs);

      if (nowMs - lastPersistedReminderCheckRef.current >= 30_000) {
        saveLastReminderCheck(nowMs);
        lastPersistedReminderCheckRef.current = nowMs;
      }

      if (dueReminders.length > 0) {
        for (const due of dueReminders) triggeredEventRemindersRef.current.add(due.key);
        saveTriggeredReminderKeys(triggeredEventRemindersRef.current);
      }

      const reminders = [...dueReminders.map((due) => due.reminder), ...snoozedDue.map((item) => item.reminder)];
      if (reminders.length > 0) {
        if (currentMode === 'break' || activeEventReminderRef.current || nowMs < doNotDisturbUntilRef.current) {
          pendingEventRemindersRef.current.push(...reminders);
          for (const reminder of reminders) {
            void showNativeNotification('事件提醒', reminder.title, currentSettings.notificationsEnabled);
          }
        } else {
          const [first, ...rest] = reminders;
          pendingEventRemindersRef.current.push(...rest);
          showEventReminder(first);
        }
      }

      if (doNotDisturbUntilRef.current > 0 && nowMs >= doNotDisturbUntilRef.current) {
        setDoNotDisturbUntilValue(0);
        if (!activeEventReminderRef.current) showNextQueuedReminder();
      }

      if (!insideWork && currentMode !== 'break') {
        if (currentMode !== 'idle') setModeValue('idle');
        setRemainingSeconds(0);
        if (activeEventReminderRef.current) presentWindow('idle', true);
        else if (visibilityReasonRef.current !== 'hidden-by-user') {
          visibilityReasonRef.current = 'hidden-outside-work-hours';
          windowController.request({ presentation: 'hidden' });
        }
        return;
      }

      if (currentMode === 'idle' && insideWork) {
        setModeValue('work');
        setPhaseEndValue(nowMs + currentSettings.focusMinutes * 60_000);
        if (visibilityReasonRef.current === 'hidden-outside-work-hours') visibilityReasonRef.current = 'visible';
        presentWindow('work');
        return;
      }

      if (currentMode === 'paused') return;

      const left = secondsUntil(phaseEndRef.current);
      setRemainingSeconds(left);
      if (left > 0) return;
      if (currentMode === 'work') startBreak(currentSettings.breakMinutes, false);
      else if (currentMode === 'break') startWork();
    }, 1000);

    return () => {
      window.clearInterval(timer);
      saveLastReminderCheck(lastReminderCheckRef.current);
    };
  }, [presentWindow, setDoNotDisturbUntilValue, setModeValue, setPhaseEndValue, showEventReminder, showNextQueuedReminder, startBreak, startWork]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!settingsRef.current.idleResetEnabled || modeRef.current !== 'work') return;
      void getSystemIdleSeconds().then((idleSeconds) => {
        const threshold = settingsRef.current.idleResetMinutes * 60;
        if (idleSeconds >= threshold && !idleResetArmedRef.current) {
          idleResetArmedRef.current = true;
          setPhaseEndValue(Date.now() + settingsRef.current.focusMinutes * 60_000);
          void showNativeNotification('已记录自然休息', '检测到你离开了电脑，专注计时已重新开始。', settingsRef.current.notificationsEnabled);
        } else if (idleSeconds < 10) {
          idleResetArmedRef.current = false;
        }
      });
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [setPhaseEndValue]);

  const handleCommand = useCallback((command: string) => {
    switch (command) {
      case 'break-now': startBreak(undefined, true); break;
      case 'extend-break-1': extendBreak(1); break;
      case 'pause-toggle': pauseToggle(); break;
      case 'dnd-30': activateDoNotDisturb(30); break;
      case 'show-panel':
        visibilityReasonRef.current = 'visible';
        presentWindow(modeRef.current, true);
        break;
      case 'hide-panel': hideCompanionPanel(); break;
    }
  }, [activateDoNotDisturb, extendBreak, hideCompanionPanel, pauseToggle, presentWindow, startBreak]);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    const trayPromise = listen<string>('tray-command', (event) => handleCommand(event.payload));
    const appPromise = listen<string>('app-command', (event) => handleCommand(event.payload));
    const settingsPromise = listen<DeskPetSettings>('settings-updated', (event) => {
      const next = sanitizeSettings(event.payload);
      settingsRef.current = next;
      setSettingsState(next);
    });
    return () => {
      void trayPromise.then((unlisten) => unlisten());
      void appPromise.then((unlisten) => unlisten());
      void settingsPromise.then((unlisten) => unlisten());
    };
  }, [handleCommand]);

  const tooltip = useMemo(() => {
    if (mode === 'break') return `休息中 · ${formatDuration(remainingSeconds)}`;
    if (mode === 'paused') return `已暂停 · 剩余 ${Math.ceil(remainingSeconds / 60)} 分钟`;
    if (doNotDisturbUntil > Date.now()) return `勿扰中 · 至 ${new Date(doNotDisturbUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    if (mode === 'work') return `专注中 · ${Math.ceil(remainingSeconds / 60)} 分钟后休息`;
    return '非工作时段';
  }, [doNotDisturbUntil, mode, remainingSeconds]);

  useEffect(() => {
    void updateTrayTooltip(tooltip);
  }, [tooltip]);

  const statusText = mode === 'work' ? '工作陪伴中' : mode === 'paused' ? '计时已暂停' : '非工作时段';

  return (
    <main className={`app mode-${mode} ${settings.strictBreakOverlay ? 'strict' : 'gentle'}`}>
      {mode === 'break' ? (
        <BreakScreen
          pets={pets}
          remainingSeconds={remainingSeconds}
          onExtendOne={() => extendBreak(1)}
          onExtendFive={() => extendBreak(5)}
        />
      ) : (
        <CompanionPanel
          mode={mode}
          statusText={statusText}
          remainingSeconds={remainingSeconds}
          activeEventReminder={activeEventReminder}
          doNotDisturbUntil={doNotDisturbUntil}
          onStartBreak={() => startBreak(undefined, true)}
          onPauseToggle={pauseToggle}
          onDoNotDisturb={() => activateDoNotDisturb(30)}
          onOpenSettings={() => void showSettingsWindow()}
          onHideCompanionPanel={hideCompanionPanel}
          onDismissEventReminder={dismissEventReminder}
          onSnoozeEventReminder={() => snoozeEventReminder(10)}
          onStartDrag={() => {
            if (!isTauriRuntime()) return;
            void getCurrentWindow().startDragging();
          }}
        />
      )}
    </main>
  );
}
