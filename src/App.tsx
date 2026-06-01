import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow, LogicalPosition, LogicalSize } from '@tauri-apps/api/window';
import type { DeskPetSettings, PetMode, Weekday } from './types';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, sanitizeSettings } from './settings';
import { formatDuration, isInsideWorkWindow, secondsUntil } from './time';
import { createPetSeeds } from './pets';

const WEEKDAYS: Array<{ id: Weekday; label: string }> = [
  { id: 'Mon', label: '一' },
  { id: 'Tue', label: '二' },
  { id: 'Wed', label: '三' },
  { id: 'Thu', label: '四' },
  { id: 'Fri', label: '五' },
  { id: 'Sat', label: '六' },
  { id: 'Sun', label: '日' }
];

function isTauriRuntime() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function randomDigit(previous?: string) {
  const digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const candidates = previous ? digits.filter((digit) => digit !== previous) : digits;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

async function playBreakChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    const now = context.currentTime;
    const master = context.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.16, now + 0.03);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.78);
    master.connect(context.destination);

    [660, 880, 1175].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = now + index * 0.16;
      const stop = start + 0.18;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.22, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, stop);
      oscillator.connect(gain).connect(master);
      oscillator.start(start);
      oscillator.stop(stop + 0.02);
    });

    window.setTimeout(() => {
      void context.close();
    }, 1000);
  } catch (error) {
    console.warn('Break chime failed:', error);
  }
}

export default function App() {
  const [settings, setSettingsState] = useState<DeskPetSettings>(() => loadSettings());
  const [mode, setMode] = useState<PetMode>('idle');
  const [panelOpen, setPanelOpen] = useState(false);
  const [phaseEnd, setPhaseEnd] = useState(() => Date.now() + DEFAULT_SETTINGS.focusMinutes * 60_000);
  const [remainingSeconds, setRemainingSeconds] = useState(() => secondsUntil(phaseEnd));
  const [salt, setSalt] = useState(() => Math.floor(Math.random() * 10_000));
  const [exitDigit, setExitDigit] = useState(() => randomDigit());
  const modeRef = useRef<PetMode>(mode);
  const settingsRef = useRef(settings);
  const phaseEndRef = useRef(phaseEnd);
  const exitDigitRef = useRef(exitDigit);

  const pets = useMemo(
    () => createPetSeeds(settings.breakPetCount, salt),
    [settings.breakPetCount, salt]
  );

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    settingsRef.current = settings;
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    phaseEndRef.current = phaseEnd;
  }, [phaseEnd]);

  useEffect(() => {
    exitDigitRef.current = exitDigit;
  }, [exitDigit]);

  const applyWindowMode = useCallback(async (nextMode: PetMode, settingsPanelOpen = panelOpen) => {
    if (!isTauriRuntime()) return;
    const appWindow = getCurrentWindow();

    try {
      await appWindow.setAlwaysOnTop(true);
      await appWindow.setDecorations(false);
      await appWindow.setResizable(false);

      if (nextMode === 'break') {
        await appWindow.setSize(new LogicalSize(window.screen.width, window.screen.height));
        await appWindow.setPosition(new LogicalPosition(0, 0));
        await appWindow.show();
        await appWindow.setFocus();
        return;
      }

      const width = settingsPanelOpen ? 360 : 236;
      const height = settingsPanelOpen ? 560 : 236;
      const x = Math.max(16, window.screen.availWidth - width - 28);
      const y = Math.max(16, window.screen.availHeight - height - 44);
      await appWindow.setSize(new LogicalSize(width, height));
      await appWindow.setPosition(new LogicalPosition(x, y));
      await appWindow.show();
    } catch (error) {
      console.warn('Failed to update Tauri window:', error);
    }
  }, [panelOpen]);

  const startWork = useCallback(() => {
    const now = new Date();
    const nextMode: PetMode = isInsideWorkWindow(now, settingsRef.current) ? 'work' : 'idle';
    setMode(nextMode);
    setPhaseEnd(Date.now() + settingsRef.current.focusMinutes * 60_000);
    setSalt((value) => value + 1);
    void applyWindowMode(nextMode);
  }, [applyWindowMode]);

  const startBreak = useCallback((minutes = settingsRef.current.breakMinutes) => {
    setMode('break');
    setPhaseEnd(Date.now() + minutes * 60_000);
    setExitDigit((current) => randomDigit(current));
    setSalt((value) => value + 1);
    setPanelOpen(false);
    void applyWindowMode('break', false);
    void playBreakChime();
  }, [applyWindowMode]);

  const extendBreak = useCallback((minutes: number) => {
    setMode('break');
    setPhaseEnd((currentEnd) => Math.max(currentEnd, Date.now()) + minutes * 60_000);
    setSalt((value) => value + 1);
    setPanelOpen(false);
    void applyWindowMode('break', false);
  }, [applyWindowMode]);

  useEffect(() => {
    const init = async () => {
      if (isTauriRuntime()) {
        try {
          const auto = await isEnabled();
          setSettingsState((value) => ({ ...value, autoStart: auto }));
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
      const currentSettings = settingsRef.current;
      const currentMode = modeRef.current;
      const insideWork = isInsideWorkWindow(now, currentSettings);

      if (!insideWork && currentMode !== 'break') {
        if (currentMode !== 'idle') {
          setMode('idle');
          void applyWindowMode('idle');
        }
        setRemainingSeconds(0);
        return;
      }

      const left = secondsUntil(phaseEndRef.current);
      setRemainingSeconds(left);

      if (currentMode === 'idle' && insideWork) {
        startWork();
        return;
      }

      if (left > 0) return;

      if (currentMode === 'work') {
        startBreak();
      } else if (currentMode === 'break') {
        startWork();
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [applyWindowMode, startBreak, startWork]);

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
        case 'toggle-settings':
          setPanelOpen((open) => {
            const next = !open;
            void applyWindowMode(modeRef.current, next);
            return next;
          });
          break;
      }
    });

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [applyWindowMode, extendBreak, startBreak]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (settingsRef.current.allowEscExit && modeRef.current === 'break' && event.key === exitDigitRef.current) {
        startWork();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [startWork]);

  const updateSettings = useCallback((patch: Partial<DeskPetSettings>) => {
    setSettingsState((current) => sanitizeSettings({ ...current, ...patch }));
  }, []);

  const toggleAutoStart = async () => {
    const next = !settings.autoStart;
    updateSettings({ autoStart: next });

    if (!isTauriRuntime()) return;
    try {
      if (next) await enable();
      else await disable();
    } catch (error) {
      console.warn('Failed to change autostart:', error);
      updateSettings({ autoStart: !next });
    }
  };

  const toggleWeekday = (day: Weekday) => {
    const nextDays = settings.workDays.includes(day)
      ? settings.workDays.filter((item) => item !== day)
      : [...settings.workDays, day];
    updateSettings({ workDays: nextDays });
  };

  const statusText = mode === 'break'
    ? '休息模式'
    : mode === 'work'
      ? '工作陪伴中'
      : '非工作时段';

  return (
    <main className={`app mode-${mode} ${settings.strictBreakOverlay ? 'strict' : 'gentle'}`}>
      {mode === 'break' ? (
        <BreakScreen
          pets={pets}
          remainingSeconds={remainingSeconds}
          exitDigit={exitDigit}
          allowShortcutExit={settings.allowEscExit}
          onExtendOne={() => extendBreak(1)}
          onExtendFive={() => extendBreak(5)}
        />
      ) : (
        <CompanionPanel
          mode={mode}
          statusText={statusText}
          remainingSeconds={remainingSeconds}
          panelOpen={panelOpen}
          settings={settings}
          onStartBreak={() => startBreak()}
          onTogglePanel={() => {
            const next = !panelOpen;
            setPanelOpen(next);
            void applyWindowMode(mode, next);
          }}
          onStartDrag={() => {
            if (!isTauriRuntime()) return;
            void getCurrentWindow().startDragging();
          }}
          onToggleAutoStart={toggleAutoStart}
          onUpdateSettings={updateSettings}
          onToggleWeekday={toggleWeekday}
        />
      )}
    </main>
  );
}

function CompanionPanel(props: {
  mode: PetMode;
  statusText: string;
  remainingSeconds: number;
  panelOpen: boolean;
  settings: DeskPetSettings;
  onStartBreak: () => void;
  onTogglePanel: () => void;
  onStartDrag: () => void;
  onToggleAutoStart: () => void;
  onUpdateSettings: (patch: Partial<DeskPetSettings>) => void;
  onToggleWeekday: (day: Weekday) => void;
}) {
  return (
    <section className="companion" onMouseDown={(event) => {
      const target = event.target as HTMLElement;
      if (target.closest('button, input, label')) return;
      props.onStartDrag();
    }}>
      <div className="pet-card">
        <button className="icon-button settings-button" onClick={props.onTogglePanel} title="设置">
          ⚙️
        </button>
        <div className="single-pet" aria-label="桌宠">🐱</div>
        <div className="speech">
          <strong>{props.statusText}</strong>
          <span>
            {props.mode === 'work'
              ? `下次休息 ${formatDuration(props.remainingSeconds)}`
              : props.mode === 'idle'
                ? '到工作时段我会提醒你'
                : '休息中'}
          </span>
        </div>
        <div className="actions single-action">
          <button onClick={props.onStartBreak}>立即休息</button>
        </div>
      </div>

      {props.panelOpen && (
        <div className="settings-panel">
          <h2>提醒设置</h2>
          <div className="field-grid">
            <label>
              <span>工作开始</span>
              <input
                type="time"
                value={props.settings.workStart}
                onChange={(event) => props.onUpdateSettings({ workStart: event.currentTarget.value })}
              />
            </label>
            <label>
              <span>工作结束</span>
              <input
                type="time"
                value={props.settings.workEnd}
                onChange={(event) => props.onUpdateSettings({ workEnd: event.currentTarget.value })}
              />
            </label>
            <label>
              <span>专注分钟</span>
              <input
                type="number"
                min={5}
                max={180}
                value={props.settings.focusMinutes}
                onChange={(event) => props.onUpdateSettings({ focusMinutes: Number(event.currentTarget.value) })}
              />
            </label>
            <label>
              <span>休息分钟</span>
              <input
                type="number"
                min={1}
                max={60}
                value={props.settings.breakMinutes}
                onChange={(event) => props.onUpdateSettings({ breakMinutes: Number(event.currentTarget.value) })}
              />
            </label>
          </div>

          <label className="range-field">
            <span>休息桌宠数量：{props.settings.breakPetCount}</span>
            <input
              type="range"
              min={60}
              max={200}
              value={props.settings.breakPetCount}
              onChange={(event) => props.onUpdateSettings({ breakPetCount: Number(event.currentTarget.value) })}
            />
          </label>

          <div className="weekday-list" aria-label="工作日">
            {WEEKDAYS.map((day) => (
              <button
                key={day.id}
                className={props.settings.workDays.includes(day.id) ? 'selected' : ''}
                onClick={() => props.onToggleWeekday(day.id)}
              >
                {day.label}
              </button>
            ))}
          </div>

          <div className="switches">
            <SwitchRow label="开机自动启动" checked={props.settings.autoStart} onChange={props.onToggleAutoStart} />
            <SwitchRow
              label="休息时半透明遮罩"
              checked={props.settings.strictBreakOverlay}
              onChange={() => props.onUpdateSettings({ strictBreakOverlay: !props.settings.strictBreakOverlay })}
            />
            <SwitchRow
              label="数字键退出休息模式"
              checked={props.settings.allowEscExit}
              onChange={() => props.onUpdateSettings({ allowEscExit: !props.settings.allowEscExit })}
            />
          </div>
        </div>
      )}
    </section>
  );
}

function BreakScreen(props: {
  pets: ReturnType<typeof createPetSeeds>;
  remainingSeconds: number;
  exitDigit: string;
  allowShortcutExit: boolean;
  onExtendOne: () => void;
  onExtendFive: () => void;
}) {
  return (
    <section className="break-screen">
      <div className="break-message">
        <div className="message-pet">🐱</div>
        <h1>休息时间到！</h1>
        <p>站起来走一走，看看远处，喝口水。桌宠们会陪你休息。</p>
        {props.allowShortcutExit && (
          <p className="shortcut-note">本轮返回工作快捷键：数字 {props.exitDigit}</p>
        )}
        <strong className="countdown">{formatDuration(props.remainingSeconds)}</strong>
        <div className="break-actions">
          <button onClick={props.onExtendOne}>再休息 1 分钟</button>
          <button onClick={props.onExtendFive}>再休息 5 分钟</button>
        </div>
      </div>

      <div className="pet-cloud" aria-hidden="true">
        {props.pets.map((pet) => (
          <div
            className="floating-pet"
            key={pet.id}
            style={{
              left: `${pet.left}%`,
              top: `${pet.top}%`,
              fontSize: `${pet.size}px`,
              animationDelay: `${pet.delay}s`,
              animationDuration: `${pet.duration}s`,
              rotate: `${pet.rotate}deg`
            }}
          >
            <span>{pet.emoji}</span>
            {pet.id % 7 === 0 && <em>{pet.phrase}</em>}
          </div>
        ))}
      </div>
    </section>
  );
}

function SwitchRow(props: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="switch-row">
      <span>{props.label}</span>
      <button className={`switch ${props.checked ? 'on' : ''}`} onClick={props.onChange} type="button">
        <span />
      </button>
    </label>
  );
}
