import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { playBreakChime } from './audio';
import { BreakScreen } from './components/BreakScreen';
import { CompanionPanel } from './components/CompanionPanel';
import { createPetSeeds } from './pets';
import {
  findDueEventReminders,
  loadLastReminderCheck,
  loadTriggeredReminderKeys,
  saveLastReminderCheck,
  saveTriggeredReminderKeys
} from './reminderScheduler';
import { loadSettings, saveSettings } from './settings';
import { isInsideWorkWindow, secondsUntil } from './time';
import type { DeskPetSettings, EventReminder, PetMode, Weekday } from './types';
import { isTauriRuntime, windowController } from './windowController';

type VisibilityReason = 'visible' | 'hidden-by-user' | 'hidden-outside-work-hours';

function randomDigit(previous?: string) {
  const digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const candidates = previous ? digits.filter((digit) => digit !== previous) : digits;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export default function App() {
  const [settings, setSettingsState] = useState<DeskPetSettings>(() => loadSettings());
  const [mode, setMode] = useState<PetMode>('idle');
  const [panelOpen, setPanelOpen] = useState(false);
  const [phaseEnd, setPhaseEnd] = useState(() => Date.now() + settings.focusMinutes * 60_000);
  const [remainingSeconds, setRemainingSeconds] = useState(() => secondsUntil(phaseEnd));
  const [salt, setSalt] = useState(() => Math.floor(Math.random() * 10_000));
  const [exitDigit, setExitDigit] = useState(() => randomDigit());
  const [activeEventReminder, setActiveEventReminder] = useState<EventReminder | null>(null);

  const settingsRef = useRef(settings);
  const modeRef = useRef<PetMode>(mode);
  const panelOpenRef = useRef(panelOpen);
  const phaseEndRef = useRef(phaseEnd);
  const exitDigitRef = useRef(exitDigit);
  const activeEventReminderRef = useRef<EventReminder | null>(activeEventReminder);
  const visibilityReasonRef = useRef<VisibilityReason>('visible');
  const pendingEventRemindersRef = useRef<EventReminder[]>([]);
  const triggeredEventRemindersRef = useRef(loadTriggeredReminderKeys());
  const lastReminderCheckRef = useRef(loadLastReminderCheck());
  const lastPersistedReminderCheckRef = useRef(lastReminderCheckRef.current);
  const initializedRef = useRef(false);

  const pets = useMemo(
    () => createPetSeeds(settings.breakPetCount, salt),
    [settings.breakPetCount, salt]
  );

  const setModeValue = useCallback((nextMode: PetMode) => {
    modeRef.current = nextMode;
    setMode(nextMode);
  }, []);

  const setPanelOpenValue = useCallback((open: boolean) => {
    panelOpenRef.current = open;
    setPanelOpen(open);
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

  const presentWindow = useCallback((nextMode: PetMode, settingsOpen: boolean, force = false) => {
    if (nextMode === 'break') {
      windowController.request({ presentation: 'break', focus: true });
      return;
    }

    if (!force && visibilityReasonRef.current !== 'visible') {
      windowController.request({ presentation: 'hidden' });
      return;
    }

    windowController.request({ presentation: settingsOpen ? 'settings' : 'companion', focus: force });
  }, []);

  const showEventReminder = useCallback((reminder: EventReminder, playSound = true) => {
    setActiveEventReminderValue(reminder);
    setPanelOpenValue(false);
    visibilityReasonRef.current = 'visible';
    presentWindow(modeRef.current === 'break' ? 'work' : modeRef.current, false, true);
    if (playSound) void playBreakChime();
  }, [presentWindow, setActiveEventReminderValue, setPanelOpenValue]);

  const showNextQueuedReminder = useCallback(() => {
    const next = pendingEventRemindersRef.current.shift() ?? null;
    if (next) {
      showEventReminder(next);
      return true;
    }
    return false;
  }, [showEventReminder]);

  const startWork = useCallback(() => {
    const now = new Date();
    const nextMode: PetMode = isInsideWorkWindow(now, settingsRef.current) ? 'work' : 'idle';
    setModeValue(nextMode);
    setPanelOpenValue(false);
    setPhaseEndValue(Date.now() + settingsRef.current.focusMinutes * 60_000);
    setSalt((value) => value + 1);

    const queuedReminder = pendingEventRemindersRef.current.shift() ?? null;
    setActiveEventReminderValue(queuedReminder);

    if (queuedReminder) {
      visibilityReasonRef.current = 'visible';
      presentWindow(nextMode, false, true);
      void playBreakChime();
      return;
    }

    if (nextMode === 'idle') {
      visibilityReasonRef.current = 'hidden-outside-work-hours';
      windowController.request({ presentation: 'hidden' });
      return;
    }

    visibilityReasonRef.current = 'visible';
    presentWindow(nextMode, false);
  }, [presentWindow, setActiveEventReminderValue, setModeValue, setPanelOpenValue, setPhaseEndValue]);

  const startBreak = useCallback((minutes = settingsRef.current.breakMinutes) => {
    if (activeEventReminderRef.current) {
      pendingEventRemindersRef.current.unshift(activeEventReminderRef.current);
    }

    setModeValue('break');
    setActiveEventReminderValue(null);
    setPanelOpenValue(false);
    setPhaseEndValue(Date.now() + minutes * 60_000);
    const nextDigit = randomDigit(exitDigitRef.current);
    exitDigitRef.current = nextDigit;
    setExitDigit(nextDigit);
    setSalt((value) => value + 1);
    visibilityReasonRef.current = 'visible';
    presentWindow('break', false, true);
    void playBreakChime();
  }, [presentWindow, setActiveEventReminderValue, setModeValue, setPanelOpenValue, setPhaseEndValue]);

  const extendBreak = useCallback((minutes: number) => {
    setModeValue('break');
    setPhaseEndValue(Math.max(phaseEndRef.current, Date.now()) + minutes * 60_000);
    setPanelOpenValue(false);
    visibilityReasonRef.current = 'visible';
    presentWindow('break', false, true);
  }, [presentWindow, setModeValue, setPanelOpenValue, setPhaseEndValue]);

  const dismissEventReminder = useCallback(() => {
    setActiveEventReminderValue(null);
    if (showNextQueuedReminder()) return;

    if (!isInsideWorkWindow(new Date(), settingsRef.current)) {
      visibilityReasonRef.current = 'hidden-outside-work-hours';
      windowController.request({ presentation: 'hidden' });
      return;
    }

    visibilityReasonRef.current = 'visible';
    presentWindow(modeRef.current, false);
  }, [presentWindow, setActiveEventReminderValue, showNextQueuedReminder]);

  useEffect(() => {
    settingsRef.current = settings;
    const timer = window.setTimeout(() => saveSettings(settings), 400);
    return () => window.clearTimeout(timer);
  }, [settings]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const init = async () => {
      if (isTauriRuntime()) {
        try {
          const auto = await isEnabled();
          setSettingsState((current) => {
            const next = { ...current, autoStart: auto };
            settingsRef.current = next;
            return next;
          });
        } catch (error) {
          console.warn('Autostart state unavailable:', error);
        }
      }
      startWork();
    };

    void init();
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

      if (nowMs - lastPersistedReminderCheckRef.current >= 30_000) {
        saveLastReminderCheck(nowMs);
        lastPersistedReminderCheckRef.current = nowMs;
      }

      if (dueReminders.length > 0) {
        for (const due of dueReminders) {
          triggeredEventRemindersRef.current.add(due.key);
        }
        saveTriggeredReminderKeys(triggeredEventRemindersRef.current);

        const reminders = dueReminders.map((due) => due.reminder);
        if (currentMode === 'break' || activeEventReminderRef.current) {
          pendingEventRemindersRef.current.push(...reminders);
        } else {
          const [first, ...rest] = reminders;
          pendingEventRemindersRef.current.push(...rest);
          showEventReminder(first);
        }
      }

      if (!insideWork && currentMode !== 'break') {
        if (currentMode !== 'idle') {
          setModeValue('idle');
          setPanelOpenValue(false);
        }
        setRemainingSeconds(0);

        if (activeEventReminderRef.current) {
          presentWindow('idle', false, true);
        } else if (visibilityReasonRef.current !== 'hidden-by-user') {
          visibilityReasonRef.current = 'hidden-outside-work-hours';
          windowController.request({ presentation: 'hidden' });
        }
        return;
      }

      if (currentMode === 'idle' && insideWork) {
        setModeValue('work');
        setPhaseEndValue(nowMs + currentSettings.focusMinutes * 60_000);
        if (visibilityReasonRef.current === 'hidden-outside-work-hours') {
          visibilityReasonRef.current = 'visible';
        }
        presentWindow('work', panelOpenRef.current);
        return;
      }

      const left = secondsUntil(phaseEndRef.current);
      setRemainingSeconds(left);
      if (left > 0) return;

      if (currentMode === 'work') startBreak();
      else if (currentMode === 'break') startWork();
    }, 1000);

    return () => {
      window.clearInterval(timer);
      saveLastReminderCheck(lastReminderCheckRef.current);
    };
  }, [presentWindow, setModeValue, setPanelOpenValue, setPhaseEndValue, showEventReminder, startBreak, startWork]);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    const unlistenPromise = listen<string>('tray-command', (event) => {
      switch (event.payload) {
        case 'break-now':
          startBreak();
          break;
        case 'extend-break-1':
          extendBreak(1);
          break;
        case 'show-panel':
          visibilityReasonRef.current = 'visible';
          setPanelOpenValue(false);
          presentWindow(modeRef.current, false, true);
          break;
        case 'toggle-settings': {
          const next = !panelOpenRef.current;
          visibilityReasonRef.current = 'visible';
          setPanelOpenValue(next);
          presentWindow(modeRef.current, next, true);
          break;
        }
      }
    });

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [extendBreak, presentWindow, setPanelOpenValue, startBreak]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;

      if (event.key === 'Escape' && panelOpenRef.current && modeRef.current !== 'break') {
        setPanelOpenValue(false);
        presentWindow(modeRef.current, false);
        return;
      }

      if (
        settingsRef.current.allowShortcutExit &&
        modeRef.current === 'break' &&
        event.key === exitDigitRef.current
      ) {
        startWork();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [presentWindow, setPanelOpenValue, startWork]);

  const updateSettings = useCallback((patch: Partial<DeskPetSettings>) => {
    setSettingsState((current) => {
      const next = { ...current, ...patch };
      settingsRef.current = next;
      return next;
    });
  }, []);

  const addEventReminder = useCallback(() => {
    const nextReminder: EventReminder = {
      id: `event-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      time: '09:00',
      title: '新的事件提醒',
      enabled: true
    };
    updateSettings({ eventReminders: [...settingsRef.current.eventReminders, nextReminder] });
  }, [updateSettings]);

  const updateEventReminder = useCallback((id: string, patch: Partial<EventReminder>) => {
    updateSettings({
      eventReminders: settingsRef.current.eventReminders.map((reminder) => (
        reminder.id === id ? { ...reminder, ...patch } : reminder
      ))
    });
  }, [updateSettings]);

  const deleteEventReminder = useCallback((id: string) => {
    updateSettings({
      eventReminders: settingsRef.current.eventReminders.filter((reminder) => reminder.id !== id)
    });
  }, [updateSettings]);

  const toggleAutoStart = useCallback(async () => {
    const next = !settingsRef.current.autoStart;
    updateSettings({ autoStart: next });

    if (!isTauriRuntime()) return;
    try {
      if (next) await enable();
      else await disable();
    } catch (error) {
      console.warn('Failed to change autostart:', error);
      updateSettings({ autoStart: !next });
    }
  }, [updateSettings]);

  const toggleWeekday = useCallback((day: Weekday) => {
    const currentDays = settingsRef.current.workDays;
    const nextDays = currentDays.includes(day)
      ? currentDays.filter((item) => item !== day)
      : [...currentDays, day];
    updateSettings({ workDays: nextDays });
  }, [updateSettings]);

  const hideCompanionPanel = useCallback(() => {
    if (modeRef.current === 'break') return;
    setPanelOpenValue(false);
    visibilityReasonRef.current = 'hidden-by-user';
    windowController.request({ presentation: 'hidden' });
  }, [setPanelOpenValue]);

  const togglePanel = useCallback(() => {
    const next = !panelOpenRef.current;
    visibilityReasonRef.current = 'visible';
    setPanelOpenValue(next);
    presentWindow(modeRef.current, next, true);
  }, [presentWindow, setPanelOpenValue]);

  const statusText = mode === 'work' ? '工作陪伴中' : '非工作时段';

  return (
    <main className={`app mode-${mode} ${settings.strictBreakOverlay ? 'strict' : 'gentle'}`}>
      {mode === 'break' ? (
        <BreakScreen
          pets={pets}
          remainingSeconds={remainingSeconds}
          exitDigit={exitDigit}
          allowShortcutExit={settings.allowShortcutExit}
          onExtendOne={() => extendBreak(1)}
          onExtendFive={() => extendBreak(5)}
          onEndBreak={startWork}
        />
      ) : (
        <CompanionPanel
          mode={mode}
          statusText={statusText}
          remainingSeconds={remainingSeconds}
          activeEventReminder={activeEventReminder}
          panelOpen={panelOpen}
          settings={settings}
          onStartBreak={() => startBreak()}
          onHideCompanionPanel={hideCompanionPanel}
          onDismissEventReminder={dismissEventReminder}
          onTogglePanel={togglePanel}
          onStartDrag={() => {
            if (!isTauriRuntime()) return;
            void getCurrentWindow().startDragging();
          }}
          onToggleAutoStart={toggleAutoStart}
          onUpdateSettings={updateSettings}
          onToggleWeekday={toggleWeekday}
          onAddEventReminder={addEventReminder}
          onUpdateEventReminder={updateEventReminder}
          onDeleteEventReminder={deleteEventReminder}
        />
      )}
    </main>
  );
}
