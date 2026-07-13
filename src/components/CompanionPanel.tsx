import { useEffect, useState } from 'react';
import { formatDuration } from '../time';
import type { DeskPetSettings, EventReminder, PetMode, Weekday } from '../types';

const WEEKDAYS: Array<{ id: Weekday; label: string }> = [
  { id: 'Mon', label: '一' },
  { id: 'Tue', label: '二' },
  { id: 'Wed', label: '三' },
  { id: 'Thu', label: '四' },
  { id: 'Fri', label: '五' },
  { id: 'Sat', label: '六' },
  { id: 'Sun', label: '日' }
];

export function CompanionPanel(props: {
  mode: PetMode;
  statusText: string;
  remainingSeconds: number;
  activeEventReminder: EventReminder | null;
  panelOpen: boolean;
  settings: DeskPetSettings;
  onStartBreak: () => void;
  onHideCompanionPanel: () => void;
  onDismissEventReminder: () => void;
  onTogglePanel: () => void;
  onStartDrag: () => void;
  onToggleAutoStart: () => void;
  onUpdateSettings: (patch: Partial<DeskPetSettings>) => void;
  onToggleWeekday: (day: Weekday) => void;
  onAddEventReminder: () => void;
  onUpdateEventReminder: (id: string, patch: Partial<EventReminder>) => void;
  onDeleteEventReminder: (id: string) => void;
}) {
  const [focusMinutes, setFocusMinutes] = useState(String(props.settings.focusMinutes));
  const [breakMinutes, setBreakMinutes] = useState(String(props.settings.breakMinutes));

  useEffect(() => setFocusMinutes(String(props.settings.focusMinutes)), [props.settings.focusMinutes]);
  useEffect(() => setBreakMinutes(String(props.settings.breakMinutes)), [props.settings.breakMinutes]);

  const commitNumber = (
    value: string,
    fallback: number,
    key: 'focusMinutes' | 'breakMinutes'
  ) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      if (key === 'focusMinutes') setFocusMinutes(String(fallback));
      else setBreakMinutes(String(fallback));
      return;
    }

    const minimum = key === 'focusMinutes' ? 5 : 1;
    const maximum = key === 'focusMinutes' ? 180 : 60;
    const normalized = Math.min(maximum, Math.max(minimum, Math.round(parsed)));
    if (key === 'focusMinutes') setFocusMinutes(String(normalized));
    else setBreakMinutes(String(normalized));
    props.onUpdateSettings({ [key]: normalized });
  };

  return (
    <section className="companion">
      <div className="pet-card">
        <div className="drag-handle" onMouseDown={props.onStartDrag} title="拖动桌宠" aria-label="拖动桌宠" />
        <button className="icon-button settings-button" onClick={props.onTogglePanel} title="设置" aria-label="设置">
          ⚙️
        </button>
        <button className="icon-button hide-button" onClick={props.onHideCompanionPanel} title="隐藏面板" aria-label="隐藏面板">
          🙈
        </button>
        <div className="single-pet" aria-label="桌宠" onMouseDown={props.onStartDrag}>🐱</div>
        <div className="speech" aria-live="polite">
          <strong>{props.statusText}</strong>
          <span>
            {props.activeEventReminder
              ? props.activeEventReminder.title
              : props.mode === 'work'
                ? `下次休息 ${formatDuration(props.remainingSeconds)}`
                : '到工作时段我会提醒你'}
          </span>
        </div>
        <div className="actions single-action">
          <button onClick={props.onStartBreak}>立即休息</button>
          {props.activeEventReminder && (
            <button onClick={props.onDismissEventReminder}>知道了</button>
          )}
        </div>
      </div>

      {props.panelOpen && (
        <div className="settings-panel" role="dialog" aria-label="提醒设置">
          <div className="settings-header">
            <h2>提醒设置</h2>
            <button
              type="button"
              className="settings-close-button"
              onClick={props.onTogglePanel}
              title="关闭设置"
              aria-label="关闭设置"
            >
              ×
            </button>
          </div>

          <div className="field-grid">
            <label>
              <span>工作开始</span>
              <input
                type="time"
                value={props.settings.workStart}
                onChange={(event: { currentTarget: HTMLInputElement }) => props.onUpdateSettings({ workStart: event.currentTarget.value })}
              />
            </label>
            <label>
              <span>工作结束</span>
              <input
                type="time"
                value={props.settings.workEnd}
                onChange={(event: { currentTarget: HTMLInputElement }) => props.onUpdateSettings({ workEnd: event.currentTarget.value })}
              />
            </label>
            <label>
              <span>专注分钟</span>
              <input
                type="number"
                min={5}
                max={180}
                value={focusMinutes}
                onChange={(event: { currentTarget: HTMLInputElement }) => setFocusMinutes(event.currentTarget.value)}
                onBlur={() => commitNumber(focusMinutes, props.settings.focusMinutes, 'focusMinutes')}
              />
            </label>
            <label>
              <span>休息分钟</span>
              <input
                type="number"
                min={1}
                max={60}
                value={breakMinutes}
                onChange={(event: { currentTarget: HTMLInputElement }) => setBreakMinutes(event.currentTarget.value)}
                onBlur={() => commitNumber(breakMinutes, props.settings.breakMinutes, 'breakMinutes')}
              />
            </label>
          </div>

          <label className="range-field">
            <span>休息桌宠数量：{props.settings.breakPetCount}</span>
            <input
              type="range"
              min={20}
              max={150}
              value={props.settings.breakPetCount}
              onChange={(event: { currentTarget: HTMLInputElement }) => props.onUpdateSettings({ breakPetCount: Number(event.currentTarget.value) })}
            />
          </label>

          <div className="weekday-list" aria-label="工作日">
            {WEEKDAYS.map((day) => (
              <button
                key={day.id}
                className={props.settings.workDays.includes(day.id) ? 'selected' : ''}
                onClick={() => props.onToggleWeekday(day.id)}
                aria-pressed={props.settings.workDays.includes(day.id)}
              >
                {day.label}
              </button>
            ))}
          </div>

          <div className="event-reminders">
            <div className="section-title">
              <span>事件提醒</span>
              <button type="button" onClick={props.onAddEventReminder}>添加</button>
            </div>
            {props.settings.eventReminders.length === 0 ? (
              <p className="empty-reminders">还没有事件提醒</p>
            ) : (
              props.settings.eventReminders.map((reminder) => (
                <div className="event-reminder-row" key={reminder.id}>
                  <input
                    type="time"
                    value={reminder.time}
                    onChange={(event: { currentTarget: HTMLInputElement }) => props.onUpdateEventReminder(reminder.id, { time: event.currentTarget.value })}
                  />
                  <input
                    type="text"
                    value={reminder.title}
                    maxLength={40}
                    onChange={(event: { currentTarget: HTMLInputElement }) => props.onUpdateEventReminder(reminder.id, { title: event.currentTarget.value })}
                    onBlur={(event: { currentTarget: HTMLInputElement }) => props.onUpdateEventReminder(reminder.id, { title: event.currentTarget.value.trim() })}
                    aria-label="事件内容"
                  />
                  <button
                    type="button"
                    className={reminder.enabled ? 'mini-toggle on' : 'mini-toggle'}
                    onClick={() => props.onUpdateEventReminder(reminder.id, { enabled: !reminder.enabled })}
                    role="switch"
                    aria-checked={reminder.enabled}
                    title={reminder.enabled ? '关闭提醒' : '开启提醒'}
                  >
                    {reminder.enabled ? '开' : '关'}
                  </button>
                  <button
                    type="button"
                    className="delete-reminder"
                    onClick={() => props.onDeleteEventReminder(reminder.id)}
                    title="删除提醒"
                    aria-label="删除提醒"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
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
              checked={props.settings.allowShortcutExit}
              onChange={() => props.onUpdateSettings({ allowShortcutExit: !props.settings.allowShortcutExit })}
            />
          </div>
        </div>
      )}
    </section>
  );
}

function SwitchRow(props: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <div className="switch-row">
      <span>{props.label}</span>
      <button
        className={`switch ${props.checked ? 'on' : ''}`}
        onClick={props.onChange}
        type="button"
        role="switch"
        aria-checked={props.checked}
        aria-label={props.label}
      >
        <span />
      </button>
    </div>
  );
}
