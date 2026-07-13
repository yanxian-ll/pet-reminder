import { useEffect, useRef, useState } from 'react';
import type { DeskPetSettings, EventReminder, Weekday } from '../types';

const WEEKDAYS: Array<{ id: Weekday; label: string }> = [
  { id: 'Mon', label: '一' },
  { id: 'Tue', label: '二' },
  { id: 'Wed', label: '三' },
  { id: 'Thu', label: '四' },
  { id: 'Fri', label: '五' },
  { id: 'Sat', label: '六' },
  { id: 'Sun', label: '日' }
];

export function SettingsPanel(props: {
  settings: DeskPetSettings;
  onClose: () => void;
  onToggleAutoStart: () => void;
  onUpdateSettings: (patch: Partial<DeskPetSettings>) => void;
  onToggleWeekday: (day: Weekday) => void;
  onAddEventReminder: () => void;
  onUpdateEventReminder: (id: string, patch: Partial<EventReminder>) => void;
  onDeleteEventReminder: (id: string) => void;
  onStartBreak: () => void;
  onPauseToggle: () => void;
  onDoNotDisturb: () => void;
  onExportSettings: () => void;
  onImportSettings: (file: File) => void;
}) {
  const [focusMinutes, setFocusMinutes] = useState(String(props.settings.focusMinutes));
  const [breakMinutes, setBreakMinutes] = useState(String(props.settings.breakMinutes));
  const [idleResetMinutes, setIdleResetMinutes] = useState(String(props.settings.idleResetMinutes));
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setFocusMinutes(String(props.settings.focusMinutes)), [props.settings.focusMinutes]);
  useEffect(() => setBreakMinutes(String(props.settings.breakMinutes)), [props.settings.breakMinutes]);
  useEffect(() => setIdleResetMinutes(String(props.settings.idleResetMinutes)), [props.settings.idleResetMinutes]);

  const commitNumber = (
    value: string,
    fallback: number,
    key: 'focusMinutes' | 'breakMinutes' | 'idleResetMinutes'
  ) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      if (key === 'focusMinutes') setFocusMinutes(String(fallback));
      else if (key === 'breakMinutes') setBreakMinutes(String(fallback));
      else setIdleResetMinutes(String(fallback));
      return;
    }

    const ranges = {
      focusMinutes: [5, 180],
      breakMinutes: [1, 60],
      idleResetMinutes: [1, 60]
    } as const;
    const [minimum, maximum] = ranges[key];
    const normalized = Math.min(maximum, Math.max(minimum, Math.round(parsed)));
    if (key === 'focusMinutes') setFocusMinutes(String(normalized));
    else if (key === 'breakMinutes') setBreakMinutes(String(normalized));
    else setIdleResetMinutes(String(normalized));
    props.onUpdateSettings({ [key]: normalized });
  };

  return (
    <section className="settings-panel" aria-label="提醒设置">
      <div className="settings-header">
        <div>
          <h1>桌宠提醒设置</h1>
          <p>工作节奏、事件提醒与临时控制</p>
        </div>
        <button type="button" className="settings-close-button" onClick={props.onClose} title="关闭设置" aria-label="关闭设置">×</button>
      </div>

      <section className="settings-section">
        <h2>临时控制</h2>
        <div className="command-grid">
          <button onClick={props.onStartBreak}>立即休息</button>
          <button onClick={props.onPauseToggle}>暂停 / 继续</button>
          <button onClick={props.onDoNotDisturb}>勿扰 30 分钟</button>
        </div>
      </section>

      <section className="settings-section">
        <h2>工作计划</h2>
        <div className="field-grid">
          <label><span>工作开始</span><input type="time" value={props.settings.workStart} onChange={(event: { currentTarget: HTMLInputElement }) => props.onUpdateSettings({ workStart: event.currentTarget.value })} /></label>
          <label><span>工作结束</span><input type="time" value={props.settings.workEnd} onChange={(event: { currentTarget: HTMLInputElement }) => props.onUpdateSettings({ workEnd: event.currentTarget.value })} /></label>
          <label><span>专注分钟</span><input type="number" min={5} max={180} value={focusMinutes} onChange={(event: { currentTarget: HTMLInputElement }) => setFocusMinutes(event.currentTarget.value)} onBlur={() => commitNumber(focusMinutes, props.settings.focusMinutes, 'focusMinutes')} /></label>
          <label><span>休息分钟</span><input type="number" min={1} max={60} value={breakMinutes} onChange={(event: { currentTarget: HTMLInputElement }) => setBreakMinutes(event.currentTarget.value)} onBlur={() => commitNumber(breakMinutes, props.settings.breakMinutes, 'breakMinutes')} /></label>
        </div>
        <div className="weekday-list" aria-label="工作日">
          {WEEKDAYS.map((day) => (
            <button key={day.id} className={props.settings.workDays.includes(day.id) ? 'selected' : ''} onClick={() => props.onToggleWeekday(day.id)} aria-pressed={props.settings.workDays.includes(day.id)}>{day.label}</button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h2>休息显示</h2>
        <label className="range-field">
          <span>休息桌宠数量：{props.settings.breakPetCount}</span>
          <input type="range" min={20} max={150} value={props.settings.breakPetCount} onChange={(event: { currentTarget: HTMLInputElement }) => props.onUpdateSettings({ breakPetCount: Number(event.currentTarget.value) })} />
        </label>
        <div className="switches">
          <SwitchRow label="休息时半透明遮罩" checked={props.settings.strictBreakOverlay} onChange={() => props.onUpdateSettings({ strictBreakOverlay: !props.settings.strictBreakOverlay })} />
          <SwitchRow label="显示系统通知" checked={props.settings.notificationsEnabled} onChange={() => props.onUpdateSettings({ notificationsEnabled: !props.settings.notificationsEnabled })} />
        </div>
      </section>

      <section className="settings-section">
        <h2>离开检测</h2>
        <SwitchRow label="离开电脑后自动重置专注周期" checked={props.settings.idleResetEnabled} onChange={() => props.onUpdateSettings({ idleResetEnabled: !props.settings.idleResetEnabled })} />
        <label className="single-field">
          <span>离开达到多少分钟视为完成休息</span>
          <input type="number" min={1} max={60} value={idleResetMinutes} disabled={!props.settings.idleResetEnabled} onChange={(event: { currentTarget: HTMLInputElement }) => setIdleResetMinutes(event.currentTarget.value)} onBlur={() => commitNumber(idleResetMinutes, props.settings.idleResetMinutes, 'idleResetMinutes')} />
        </label>
      </section>

      <section className="settings-section">
        <div className="section-title"><h2>事件提醒</h2><button type="button" onClick={props.onAddEventReminder}>添加</button></div>
        <div className="event-reminders">
          {props.settings.eventReminders.length === 0 ? <p className="empty-reminders">还没有事件提醒</p> : props.settings.eventReminders.map((reminder) => (
            <div className="event-reminder-row" key={reminder.id}>
              <input type="time" value={reminder.time} onChange={(event: { currentTarget: HTMLInputElement }) => props.onUpdateEventReminder(reminder.id, { time: event.currentTarget.value })} />
              <input type="text" value={reminder.title} maxLength={40} onChange={(event: { currentTarget: HTMLInputElement }) => props.onUpdateEventReminder(reminder.id, { title: event.currentTarget.value })} onBlur={(event: { currentTarget: HTMLInputElement }) => props.onUpdateEventReminder(reminder.id, { title: event.currentTarget.value.trim() })} aria-label="事件内容" />
              <button type="button" className={reminder.enabled ? 'mini-toggle on' : 'mini-toggle'} onClick={() => props.onUpdateEventReminder(reminder.id, { enabled: !reminder.enabled })} role="switch" aria-checked={reminder.enabled} title={reminder.enabled ? '关闭提醒' : '开启提醒'}>{reminder.enabled ? '开' : '关'}</button>
              <button type="button" className="delete-reminder" onClick={() => props.onDeleteEventReminder(reminder.id)} title="删除提醒" aria-label="删除提醒">×</button>
            </div>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h2>应用</h2>
        <div className="switches"><SwitchRow label="开机自动启动" checked={props.settings.autoStart} onChange={props.onToggleAutoStart} /></div>
        <div className="file-actions">
          <button onClick={props.onExportSettings}>导出配置</button>
          <button onClick={() => importInputRef.current?.click()}>导入配置</button>
          <input ref={importInputRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event: { currentTarget: HTMLInputElement }) => { const file = event.currentTarget.files?.[0]; if (file) props.onImportSettings(file); event.currentTarget.value = ''; }} />
        </div>
      </section>
    </section>
  );
}

function SwitchRow(props: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <div className="switch-row">
      <span>{props.label}</span>
      <button className={`switch ${props.checked ? 'on' : ''}`} onClick={props.onChange} type="button" role="switch" aria-checked={props.checked} aria-label={props.label}><span /></button>
    </div>
  );
}
