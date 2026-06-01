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

const BREAK_PENALTY_STORAGE_KEY = 'deskpet-rest-reminder.break-penalty-pets.v1';
const MAX_BREAK_PENALTY_PETS = 180;
const MAX_EFFECTIVE_BREAK_PETS = 360;

type RippleSeed = {
  id: number;
  x: number;
  y: number;
  size: number;
};

function isTauriRuntime() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function loadBreakPenaltyPets() {
  try {
    const raw = localStorage.getItem(BREAK_PENALTY_STORAGE_KEY);
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) ? Math.min(MAX_BREAK_PENALTY_PETS, Math.max(0, Math.round(parsed))) : 0;
  } catch {
    return 0;
  }
}

function saveBreakPenaltyPets(value: number) {
  localStorage.setItem(BREAK_PENALTY_STORAGE_KEY, String(Math.min(MAX_BREAK_PENALTY_PETS, Math.max(0, value))));
}

export default function App() {
  const [settings, setSettingsState] = useState<DeskPetSettings>(() => loadSettings());
  const [mode, setMode] = useState<PetMode>('idle');
  const [paused, setPaused] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [phaseEnd, setPhaseEnd] = useState(() => Date.now() + DEFAULT_SETTINGS.focusMinutes * 60_000);
  const [remainingSeconds, setRemainingSeconds] = useState(() => secondsUntil(phaseEnd));
  const [salt, setSalt] = useState(() => Math.floor(Math.random() * 10_000));
  const [extraBreakPetCount, setExtraBreakPetCount] = useState(() => loadBreakPenaltyPets());
  const modeRef = useRef<PetMode>(mode);
  const pausedRef = useRef(paused);
  const settingsRef = useRef(settings);
  const phaseEndRef = useRef(phaseEnd);

  const effectiveBreakPetCount = Math.min(
    MAX_EFFECTIVE_BREAK_PETS,
    settings.breakPetCount + extraBreakPetCount
  );

  const pets = useMemo(
    () => createPetSeeds(effectiveBreakPetCount, salt),
    [effectiveBreakPetCount, salt]
  );

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    settingsRef.current = settings;
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    phaseEndRef.current = phaseEnd;
  }, [phaseEnd]);

  useEffect(() => {
    saveBreakPenaltyPets(extraBreakPetCount);
  }, [extraBreakPetCount]);

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
    setPaused(false);
    setPhaseEnd(Date.now() + minutes * 60_000);
    setSalt((value) => value + 1);
    setPanelOpen(false);
    void applyWindowMode('break', false);
  }, [applyWindowMode]);

  const addEarlyExitPenalty = useCallback(() => {
    const baseCount = settingsRef.current.breakPetCount;
    const increment = Math.max(18, Math.round(baseCount * 0.35));
    setExtraBreakPetCount((value) => Math.min(MAX_BREAK_PENALTY_PETS, value + increment));
  }, []);

  const returnToWorkFromBreak = useCallback(() => {
    if (modeRef.current === 'break' && secondsUntil(phaseEndRef.current) > 5) {
      addEarlyExitPenalty();
    }
    startWork();
  }, [addEarlyExitPenalty, startWork]);

  const finishBreakNaturally = useCallback(() => {
    setExtraBreakPetCount(0);
    startWork();
  }, [startWork]);

  const togglePause = useCallback(() => {
    setPaused((value) => !value);
  }, []);

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
      const currentPaused = pausedRef.current;
      const insideWork = isInsideWorkWindow(now, currentSettings);

      if (currentPaused) {
        setRemainingSeconds(secondsUntil(phaseEndRef.current));
        return;
      }

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
        finishBreakNaturally();
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [applyWindowMode, finishBreakNaturally, startBreak, startWork]);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    const unlistenPromise = listen<string>('tray-command', (event) => {
      switch (event.payload) {
        case 'break-now':
          startBreak();
          break;
        case 'back-to-work':
          setPaused(false);
          returnToWorkFromBreak();
          break;
        case 'toggle-pause':
          togglePause();
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
  }, [applyWindowMode, returnToWorkFromBreak, startBreak, togglePause]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && settingsRef.current.allowEscExit && modeRef.current === 'break') {
        returnToWorkFromBreak();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [returnToWorkFromBreak]);

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
      ? paused
        ? '已暂停提醒'
        : '工作陪伴中'
      : '非工作时段';

  return (
    <main className={`app mode-${mode} ${settings.strictBreakOverlay ? 'strict' : 'gentle'}`}>
      {mode === 'break' ? (
        <BreakScreen
          pets={pets}
          remainingSeconds={remainingSeconds}
          extraBreakPetCount={extraBreakPetCount}
          onBackToWork={returnToWorkFromBreak}
          onExtend={() => startBreak(5)}
          allowEscExit={settings.allowEscExit}
        />
      ) : (
        <CompanionPanel
          mode={mode}
          paused={paused}
          statusText={statusText}
          remainingSeconds={remainingSeconds}
          panelOpen={panelOpen}
          settings={settings}
          onStartBreak={() => startBreak()}
          onTogglePause={togglePause}
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
  paused: boolean;
  statusText: string;
  remainingSeconds: number;
  panelOpen: boolean;
  settings: DeskPetSettings;
  onStartBreak: () => void;
  onTogglePause: () => void;
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
        <div className="actions">
          <button onClick={props.onStartBreak}>立即休息</button>
          <button onClick={props.onTogglePause}>{props.paused ? '恢复' : '暂停'}</button>
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
              min={1}
              max={260}
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
              label="Esc 退出休息模式"
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
  extraBreakPetCount: number;
  onBackToWork: () => void;
  onExtend: () => void;
  allowEscExit: boolean;
}) {
  const [ripples, setRipples] = useState<RippleSeed[]>([]);
  const lastRippleAtRef = useRef(0);

  const addRipple = useCallback((clientX: number, clientY: number, strong = false) => {
    const now = Date.now();
    if (!strong && now - lastRippleAtRef.current < 85) return;
    lastRippleAtRef.current = now;

    const id = now + Math.random();
    const ripple: RippleSeed = {
      id,
      x: clientX,
      y: clientY,
      size: strong ? 260 : 150
    };

    setRipples((current) => [...current.slice(-16), ripple]);
    window.setTimeout(() => {
      setRipples((current) => current.filter((item) => item.id !== id));
    }, 1100);
  }, []);

  return (
    <section
      className="break-screen"
      onMouseMove={(event) => addRipple(event.clientX, event.clientY)}
      onPointerDown={(event) => addRipple(event.clientX, event.clientY, true)}
    >
      <div className="ripple-layer" aria-hidden="true">
        {ripples.map((ripple) => (
          <span
            className="water-ripple"
            key={ripple.id}
            style={{
              left: `${ripple.x}px`,
              top: `${ripple.y}px`,
              width: `${ripple.size}px`,
              height: `${ripple.size}px`
            }}
          />
        ))}
      </div>

      <div className="break-message">
        <div className="message-pet">🐱</div>
        <h1>休息时间到！</h1>
        <p>站起来走一走，看看远处，喝口水。桌宠们会陪你休息。</p>
        {props.extraBreakPetCount > 0 && (
          <p className="penalty-note">上次没休息完，本次追加 {props.extraBreakPetCount} 只桌宠监督你。</p>
        )}
        <strong className="countdown">{formatDuration(props.remainingSeconds)}</strong>
        <div className="break-actions">
          <button onClick={props.onBackToWork}>回到工作</button>
          <button onClick={props.onExtend}>再休息 5 分钟</button>
        </div>
        {props.allowEscExit && <small>也可以按 Esc 安全退出休息模式；提前退出会让下次桌宠变多</small>}
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
